package com.deutschflow.speaking.service;

import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.SystemPromptBuilder;
import com.deutschflow.speaking.interview.InterviewAnswerAnalysis;
import com.deutschflow.speaking.interview.InterviewAnswerAnalyzer;
import com.deutschflow.speaking.interview.InterviewOrchestrator;
import com.deutschflow.speaking.interview.InterviewPhase;
import com.deutschflow.speaking.interview.InterviewPromptContext;
import com.deutschflow.speaking.interview.InterviewSessionState;
import com.deutschflow.speaking.interview.InterviewStateCodec;
import com.deutschflow.speaking.interview.InterviewTurnPlan;
import com.deutschflow.speaking.contract.SpeakingResponseSchema;
import com.deutschflow.speaking.contract.SpeakingSessionMode;
import com.deutschflow.speaking.persona.SpeakingPersona;
import com.deutschflow.speaking.dto.SpeakingPolicy;
import com.deutschflow.speaking.dto.WeakPoint;
import com.deutschflow.speaking.util.SpeakingCefrSupport;
import com.deutschflow.speaking.entity.AiSpeakingMessage;
import com.deutschflow.speaking.entity.AiSpeakingMessage.MessageRole;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.entity.AiSpeakingSession.SessionStatus;
import com.deutschflow.speaking.repository.AiSpeakingMessageRepository;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.common.quota.QuotaService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Prompt / message-assembly cluster extracted from {@code AiSpeakingServiceImpl}.
 *
 * <p>Owns building the LLM-facing prompt and message list for both paths:
 * the initial greeting (greeting interview context + system prompt + messages +
 * token budget) and each chat turn ({@link #prepareSpeakingChatTurn(long, long, String)},
 * which reads the session + recent history, computes policy/interview plan, and returns the
 * immutable {@link AiSpeakingServiceImpl.SpeakingChatPrep} snapshot consumed downstream by
 * the facade's chat-completion + persistence steps).
 *
 * <p>The ten methods are moved verbatim from the facade (pure move + delegate) so prompt
 * content, message ordering, history truncation, and token math are byte-for-byte unchanged.
 *
 * <p><b>Exclusive collaborators</b> (used only by these prompt builders, moved here):
 * {@code promptBuilder}, {@code quotaService}, {@code knowledgeBaseService},
 * {@code interviewAnswerAnalyzer}.
 *
 * <p><b>Shared collaborators</b> (also used by facade methods that stay — greeting orchestration,
 * session creation, turn side effects, chat completion — so they remain injected in both):
 * {@code adaptivePolicyService}, {@code adaptiveEngineService}, {@code interviewOrchestrator},
 * {@code interviewStateCodec}, {@code systemConfigService}, {@code sessionRepository},
 * {@code messageRepository}, {@code profileRepository}, {@code learningProgressService}.
 */
@Service
@Slf4j
public class ChatPrepService {

    /** Cap completion tokens per turn (quota snapshot may be lower). */
    private static final int SPEAKING_MAX_COMPLETION_TOKENS = 512;

    private final AiSpeakingSessionRepository sessionRepository;
    private final AiSpeakingMessageRepository messageRepository;
    private final UserLearningProfileRepository profileRepository;
    private final SystemPromptBuilder promptBuilder;
    private final AdaptivePolicyService adaptivePolicyService;
    private final AdaptiveEngineService adaptiveEngineService;
    private final QuotaService quotaService;
    private final InterviewOrchestrator interviewOrchestrator;
    private final InterviewAnswerAnalyzer interviewAnswerAnalyzer;
    private final InterviewStateCodec interviewStateCodec;
    private final com.deutschflow.system.service.SystemConfigService systemConfigService;
    private final com.deutschflow.ai.rag.service.KnowledgeBaseService knowledgeBaseService;
    private final LearningProgressService learningProgressService;

    public ChatPrepService(
            AiSpeakingSessionRepository sessionRepository,
            AiSpeakingMessageRepository messageRepository,
            UserLearningProfileRepository profileRepository,
            SystemPromptBuilder promptBuilder,
            AdaptivePolicyService adaptivePolicyService,
            AdaptiveEngineService adaptiveEngineService,
            QuotaService quotaService,
            InterviewOrchestrator interviewOrchestrator,
            InterviewAnswerAnalyzer interviewAnswerAnalyzer,
            InterviewStateCodec interviewStateCodec,
            com.deutschflow.system.service.SystemConfigService systemConfigService,
            com.deutschflow.ai.rag.service.KnowledgeBaseService knowledgeBaseService,
            LearningProgressService learningProgressService) {
        this.sessionRepository = sessionRepository;
        this.messageRepository = messageRepository;
        this.profileRepository = profileRepository;
        this.promptBuilder = promptBuilder;
        this.adaptivePolicyService = adaptivePolicyService;
        this.adaptiveEngineService = adaptiveEngineService;
        this.quotaService = quotaService;
        this.interviewOrchestrator = interviewOrchestrator;
        this.interviewAnswerAnalyzer = interviewAnswerAnalyzer;
        this.interviewStateCodec = interviewStateCodec;
        this.systemConfigService = systemConfigService;
        this.knowledgeBaseService = knowledgeBaseService;
        this.learningProgressService = learningProgressService;
    }

    public String resolveSessionLevel(String cefrLevel, UserLearningProfile profile) {
        // Honor the learner's explicit level choice — just normalize to a valid band.
        // Previously clampToProfileRange snapped the pick into the profile [currentLevel, targetLevel]
        // range, which silently overrode the picker (e.g. choosing A1 or C1 jumped back to the profile band).
        return (cefrLevel == null || cefrLevel.isBlank())
                ? SpeakingCefrSupport.floorPracticeBand(profile)
                : SpeakingCefrSupport.clampBand(cefrLevel);
    }

    public InterviewPromptContext buildGreetingInterviewContext(SpeakingSessionMode sessionMode,
                                                                   AiSpeakingSession sessionRow,
                                                                   SpeakingPersona persona) {
        if (sessionMode != SpeakingSessionMode.INTERVIEW) {
            return null;
        }
        InterviewSessionState state = interviewStateCodec.decode(sessionRow.getInterviewStateJson());
        state = interviewOrchestrator.ensureState(state, persona, sessionRow.getInterviewPosition());
        InterviewTurnPlan introPlan = interviewOrchestrator.planTurn(
                state, persona, sessionRow.getInterviewPosition(), sessionRow.getExperienceLevel(),
                0, null, "control", sessionRow.getCefrLevel());
        return new InterviewPromptContext(state, introPlan);
    }

    public String buildGreetingSystemPrompt(UserLearningProfile profile,
                                             List<String> knownInterests,
                                             String topic,
                                             List<WeakPoint> weakPoints,
                                             String cefrLevel,
                                             SpeakingPolicy policy,
                                             SpeakingPersona persona,
                                             SpeakingResponseSchema responseSchema,
                                             SpeakingSessionMode sessionMode,
                                             AiSpeakingSession sessionRow,
                                             InterviewPromptContext interviewContext) {
        return sessionMode == SpeakingSessionMode.INTERVIEW && interviewContext != null
                ? (policy.enabled()
                ? promptBuilder.buildSystemPrompt(
                profile, knownInterests, topic, weakPoints, cefrLevel, policy,
                persona, responseSchema, sessionMode, sessionRow.getInterviewPosition(),
                sessionRow.getExperienceLevel(), 0, interviewContext)
                : promptBuilder.buildSystemPrompt(
                profile, knownInterests, topic, weakPoints, cefrLevel, null,
                persona, responseSchema, sessionMode, sessionRow.getInterviewPosition(),
                sessionRow.getExperienceLevel(), 0, interviewContext))
                : (policy.enabled()
                ? promptBuilder.buildSystemPrompt(profile, knownInterests, topic, weakPoints, cefrLevel, policy, persona, responseSchema, sessionMode)
                : promptBuilder.buildSystemPrompt(profile, knownInterests, topic, weakPoints, cefrLevel, persona, responseSchema, sessionMode));
    }

    public List<ChatMessage> buildGreetingMessages(String systemPrompt,
                                                    SpeakingPersona persona,
                                                    String topic,
                                                    List<WeakPoint> weakPoints,
                                                    SpeakingSessionMode sessionMode,
                                                    AiSpeakingSession sessionRow,
                                                    InterviewPromptContext interviewContext) {
        String industry = sessionRow.getTopic() != null && !sessionRow.getTopic().isBlank() ? sessionRow.getTopic() : null;
        String weakPointsStr = weakPoints.stream().map(WeakPoint::grammarPoint).collect(Collectors.joining(", "));
        String greetingInstruction = sessionMode == SpeakingSessionMode.INTERVIEW
                ? """
                Erste Nachricht des Interviewers (Turn 1 / INTRO).
                Begrüßen Sie knapp auf Deutsch, stellen Sie sich als Interviewer vor, dann die Pflichtfrage aus TURN_DIRECTIVE.
                Kein Lob, kein Smalltalk. NUR JSON (optional interview_meta mit ack_de + question_de).
                """.trim()
                : persona.buildGreetingInstruction(topic, industry, weakPointsStr, sessionMode,
                sessionRow.getInterviewPosition());
        if (sessionMode == SpeakingSessionMode.INTERVIEW && interviewContext != null) {
            return List.of(
                    new ChatMessage("system", systemPrompt),
                    new ChatMessage("user", greetingInstruction)
            );
        }
        return List.of(
                new ChatMessage("system", systemPrompt),
                new ChatMessage("user", greetingInstruction)
        );
    }

    public int resolveGreetingMaxTokens(long userId) {
        var greetSnapshot = quotaService.assertAllowed(userId, Instant.now(), 1L);
        int maxTokensConfig = systemConfigService.getInteger("ai.maxTokens", SPEAKING_MAX_COMPLETION_TOKENS);
        return (int) Math.max(1L, Math.min(maxTokensConfig, greetSnapshot.remainingThisMonth()));
    }

    public AiSpeakingServiceImpl.SpeakingChatPrep prepareSpeakingChatTurn(long userId, long sessionId, String userMessage) {
        Instant turnStartedAt = Instant.now();
        AiSpeakingSession session = loadSessionForUser(userId, sessionId);
        if (session.getStatus() == SessionStatus.ENDED) {
            throw new ConflictException("This session has already ended.");
        }

        UserLearningProfile profile = profileRepository.findByUserId(userId).orElse(null);
        List<String> knownInterests = learningProgressService.extractInterests(profile);
        List<WeakPoint> weakPoints = adaptiveEngineService.getWeakPoints(userId);
        List<AiSpeakingMessage> recentMessages = loadRecentMessages(sessionId, session);

        UserLearningProfile effectiveProfile = profile != null ? profile : defaultProfile();
        SpeakingPersona persona = SpeakingPersona.fromApi(session.getPersona());
        SpeakingResponseSchema responseSchema = SpeakingResponseSchema.fromApi(session.getResponseSchema());
        SpeakingPolicy policy = adaptivePolicyService.computePolicy(userId, session, effectiveProfile, knownInterests);

        InterviewPromptContext interviewContext = null;
        InterviewAnswerAnalysis answerAnalysis = null;
        SpeakingSessionMode sessionMode = SpeakingSessionMode.fromApi(session.getSessionMode());
        if (sessionMode == SpeakingSessionMode.INTERVIEW) {
            InterviewSessionState state = interviewStateCodec.decode(session.getInterviewStateJson());
            state = interviewOrchestrator.ensureState(state, persona, session.getInterviewPosition());
            InterviewPhase phase = InterviewPhase.fromUserTurn(session.getMessageCount() / 2 + 1);
            answerAnalysis = interviewAnswerAnalyzer.analyze(userMessage, phase, session.getExperienceLevel());
            InterviewTurnPlan plan = interviewOrchestrator.planTurn(
                    state, persona, session.getInterviewPosition(), session.getExperienceLevel(),
                    session.getMessageCount(), userMessage,
                    session.getInterviewPromptVariant(), session.getCefrLevel());
            interviewContext = new InterviewPromptContext(state, plan);
        }

        String systemPrompt = buildSpeakingSystemPrompt(session, userMessage, effectiveProfile, knownInterests, weakPoints,
                persona, responseSchema, policy, sessionMode, interviewContext);
        List<ChatMessage> openAiMessages = buildOpenAiMessages(systemPrompt, recentMessages, userMessage);
        int maxTokens = resolveMaxTokens(userId);

        return new AiSpeakingServiceImpl.SpeakingChatPrep(
                userId,
                sessionId,
                policy,
                systemPrompt,
                session.getCefrLevel(),
                session.getTopic(),
                List.copyOf(openAiMessages),
                maxTokens,
                session.getMessageCount(),
                responseSchema,
                sessionMode,
                interviewContext,
                answerAnalysis,
                turnStartedAt,
                persona);
    }

    private List<AiSpeakingMessage> loadRecentMessages(long sessionId, AiSpeakingSession session) {
        List<AiSpeakingMessage> recentMessages = messageRepository.findTop10BySessionIdOrderByCreatedAtDesc(sessionId);
        Collections.reverse(recentMessages);
        int maxHistory = SpeakingSessionMode.fromApi(session.getSessionMode()) == SpeakingSessionMode.INTERVIEW ? 10 : 6;
        if (recentMessages.size() > maxHistory) {
            recentMessages = new ArrayList<>(recentMessages.subList(recentMessages.size() - maxHistory, recentMessages.size()));
        }
        return recentMessages;
    }

    private String buildSpeakingSystemPrompt(AiSpeakingSession session,
                                             String userMessage,
                                             UserLearningProfile effectiveProfile,
                                             List<String> knownInterests,
                                             List<WeakPoint> weakPoints,
                                             SpeakingPersona persona,
                                             SpeakingResponseSchema responseSchema,
                                             SpeakingPolicy policy,
                                             SpeakingSessionMode sessionMode,
                                             InterviewPromptContext interviewContext) {
        if (sessionMode == SpeakingSessionMode.INTERVIEW && interviewContext != null) {
            return policy.enabled()
                    ? promptBuilder.buildSystemPrompt(
                    effectiveProfile, knownInterests, session.getTopic(), weakPoints, session.getCefrLevel(), policy,
                    persona, responseSchema, sessionMode, session.getInterviewPosition(), session.getExperienceLevel(),
                    session.getMessageCount(), interviewContext)
                    : promptBuilder.buildSystemPrompt(
                    effectiveProfile, knownInterests, session.getTopic(), weakPoints, session.getCefrLevel(), null,
                    persona, responseSchema, sessionMode, session.getInterviewPosition(), session.getExperienceLevel(),
                    session.getMessageCount(), interviewContext);
        }

        String prompt = policy.enabled()
                ? promptBuilder.buildSystemPrompt(
                effectiveProfile, knownInterests, session.getTopic(), weakPoints, session.getCefrLevel(), policy, persona, responseSchema, sessionMode,
                session.getInterviewPosition(), session.getExperienceLevel(), session.getMessageCount())
                : promptBuilder.buildSystemPrompt(
                effectiveProfile, knownInterests, session.getTopic(), weakPoints, session.getCefrLevel(), null, persona, responseSchema, sessionMode,
                session.getInterviewPosition(), session.getExperienceLevel(), session.getMessageCount());
        if (sessionMode != SpeakingSessionMode.INTERVIEW) {
            String ragContext = knowledgeBaseService.searchRelevantContext(userMessage, session.getCefrLevel(), 2);
            if (ragContext != null && !ragContext.isBlank()) {
                prompt += "\n\n=== TÀI LIỆU HỖ TRỢ (RAG CONTEXT) ===\n" + ragContext;
            }
        }
        return prompt;
    }

    private List<ChatMessage> buildOpenAiMessages(String systemPrompt, List<AiSpeakingMessage> recentMessages, String userMessage) {
        List<ChatMessage> openAiMessages = new ArrayList<>();
        openAiMessages.add(new ChatMessage("system", systemPrompt));
        for (AiSpeakingMessage msg : recentMessages) {
            if (msg.getRole() == MessageRole.USER) {
                openAiMessages.add(new ChatMessage("user", msg.getUserText()));
            } else {
                openAiMessages.add(new ChatMessage("assistant", msg.getAiSpeechDe()));
            }
        }
        openAiMessages.add(new ChatMessage("user", userMessage));
        return openAiMessages;
    }

    private int resolveMaxTokens(long userId) {
        var snapshot = quotaService.assertAllowed(userId, Instant.now(), 1L);
        int maxTokensConfig = systemConfigService.getInteger("ai.maxTokens", SPEAKING_MAX_COMPLETION_TOKENS);
        return (int) Math.max(1L, Math.min(maxTokensConfig, snapshot.remainingThisMonth()));
    }

    private AiSpeakingSession loadSessionForUser(Long userId, Long sessionId) {
        AiSpeakingSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new NotFoundException("Session not found: " + sessionId));
        if (!session.getUserId().equals(userId)) {
            throw new NotFoundException("Session not found: " + sessionId);
        }
        return session;
    }

    private UserLearningProfile defaultProfile() {
        return UserLearningProfile.builder()
                .targetLevel(UserLearningProfile.TargetLevel.A1)
                .goalType(UserLearningProfile.GoalType.CERT)
                .currentLevel(UserLearningProfile.CurrentLevel.A0)
                .sessionsPerWeek(3)
                .minutesPerSession(30)
                .build();
    }
}
