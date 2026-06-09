package com.deutschflow.speaking.service;

import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.speaking.ai.AiParseOutcome;
import com.deutschflow.speaking.ai.AiResponseDto;
import com.deutschflow.speaking.ai.AiResponseParser;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.AiErrorSanitizer;
import com.deutschflow.speaking.ai.ChatMessage;
import com.deutschflow.speaking.ai.ErrorItem;
import com.deutschflow.speaking.ai.GroqChatClient;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.interview.InterviewAnswerAnalysis;
import com.deutschflow.speaking.interview.InterviewOrchestrator;
import com.deutschflow.speaking.interview.InterviewPhase;
import com.deutschflow.speaking.interview.PhaseProgressionPolicy;
import com.deutschflow.speaking.interview.InterviewPromptContext;
import com.deutschflow.speaking.interview.InterviewSessionState;
import com.deutschflow.speaking.interview.InterviewSpeechSanitizer;
import com.deutschflow.speaking.interview.InterviewStateCodec;
import com.deutschflow.speaking.interview.InterviewDirectiveType;
import com.deutschflow.speaking.interview.InterviewTurnPlan;
import com.deutschflow.speaking.contract.SpeakingResponseSchema;
import com.deutschflow.speaking.contract.SpeakingSessionMode;
import com.deutschflow.speaking.persona.SpeakingPersona;
import com.deutschflow.speaking.dto.AdaptiveMetaDto;
import com.deutschflow.speaking.dto.AiSpeakingChatResponse;
import com.deutschflow.speaking.dto.AiSpeakingMessageDto;
import com.deutschflow.speaking.dto.AiSpeakingSessionDto;
import com.deutschflow.speaking.dto.ErrorItemDto;
import com.deutschflow.speaking.dto.SpeakingPolicy;
import com.deutschflow.speaking.dto.WeakPoint;
import com.deutschflow.speaking.entity.AiSpeakingMessage;
import com.deutschflow.speaking.entity.AiSpeakingMessage.MessageRole;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.entity.AiSpeakingSession.SessionStatus;
import com.deutschflow.speaking.entity.UserGrammarError;
import com.deutschflow.speaking.metrics.SpeakingMetrics;
import com.deutschflow.speaking.repository.AiSpeakingMessageRepository;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.speaking.repository.UserGrammarErrorRepository;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.common.quota.RequestContext;
import com.deutschflow.gamification.service.XpService;
import com.deutschflow.training.service.TrainingDatasetService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

@Service
@Slf4j
public class AiSpeakingServiceImpl implements AiSpeakingService {

    /** Lower-variance JSON / tutor replies for structured V1/V2. */
    private static final double SPEAKING_CHAT_TEMPERATURE = 0.35;
    /** Initial greeting: warmer than chat but still structured JSON. */
    private static final double GREETING_TEMPERATURE = 0.5;

    private final TransactionTemplate transactionTemplate;
    private final AiSpeakingSessionRepository sessionRepository;
    private final AiSpeakingMessageRepository messageRepository;
    private final UserLearningProfileRepository profileRepository;
    private final UserGrammarErrorRepository grammarErrorRepository;
    private final OpenAiChatClient openAiChatClient;
    /** Interview mode forces this hosted client for reliable structured JSON (see {@link #chatClientFor}). */
    private final GroqChatClient groqChatClient;
    private final AiResponseParser responseParser;
    private final ObjectMapper objectMapper;
    private final SpeakingMetrics speakingMetrics;
    private final GrammarPersistenceService grammarPersistenceService;
    private final AdaptivePolicyService adaptivePolicyService;
    private final AdaptiveEngineService adaptiveEngineService;
    private final TurnEvaluatorService turnEvaluatorService;
    private final AiUsageLedgerService aiUsageLedgerService;
    private final TrainingDatasetService trainingDatasetService;
    private final XpService xpService;
    private final ConversationEvaluationService conversationEvaluationService;
    private final InterviewOrchestrator interviewOrchestrator;
    private final InterviewStateCodec interviewStateCodec;
    private final InterviewSpeechSanitizer interviewSpeechSanitizer;
    private final com.deutschflow.system.service.SystemConfigService systemConfigService;
    private final Executor speakingStreamExecutor;
    private final SessionTurnGuard sessionTurnGuard;
    private final com.deutschflow.interview.service.InterviewDomainCoordinator interviewDomainCoordinator;
    private final SessionLifecycleService sessionLifecycleService;
    private final LearningProgressService learningProgressService;
    private final ChatPrepService chatPrepService;

    public AiSpeakingServiceImpl(
            TransactionTemplate transactionTemplate,
            AiSpeakingSessionRepository sessionRepository,
            AiSpeakingMessageRepository messageRepository,
            UserLearningProfileRepository profileRepository,
            UserGrammarErrorRepository grammarErrorRepository,
            OpenAiChatClient openAiChatClient,
            GroqChatClient groqChatClient,
            AiResponseParser responseParser,
            ObjectMapper objectMapper,
            SpeakingMetrics speakingMetrics,
            GrammarPersistenceService grammarPersistenceService,
            AdaptivePolicyService adaptivePolicyService,
            AdaptiveEngineService adaptiveEngineService,
            TurnEvaluatorService turnEvaluatorService,
            AiUsageLedgerService aiUsageLedgerService,
            TrainingDatasetService trainingDatasetService,
            XpService xpService,
            ConversationEvaluationService conversationEvaluationService,
            InterviewOrchestrator interviewOrchestrator,
            InterviewStateCodec interviewStateCodec,
            InterviewSpeechSanitizer interviewSpeechSanitizer,
            com.deutschflow.system.service.SystemConfigService systemConfigService,
            @Qualifier("speakingStreamExecutor") Executor speakingStreamExecutor,
            SessionTurnGuard sessionTurnGuard,
            com.deutschflow.interview.service.InterviewDomainCoordinator interviewDomainCoordinator,
            SessionLifecycleService sessionLifecycleService,
            LearningProgressService learningProgressService,
            ChatPrepService chatPrepService) {
        this.transactionTemplate = transactionTemplate;
        this.sessionRepository = sessionRepository;
        this.messageRepository = messageRepository;
        this.profileRepository = profileRepository;
        this.grammarErrorRepository = grammarErrorRepository;
        this.openAiChatClient = openAiChatClient;
        this.groqChatClient = groqChatClient;
        this.responseParser = responseParser;
        this.objectMapper = objectMapper;
        this.speakingMetrics = speakingMetrics;
        this.grammarPersistenceService = grammarPersistenceService;
        this.adaptivePolicyService = adaptivePolicyService;
        this.adaptiveEngineService = adaptiveEngineService;
        this.turnEvaluatorService = turnEvaluatorService;
        this.aiUsageLedgerService = aiUsageLedgerService;
        this.trainingDatasetService = trainingDatasetService;
        this.xpService = xpService;
        this.conversationEvaluationService = conversationEvaluationService;
        this.interviewOrchestrator = interviewOrchestrator;
        this.interviewStateCodec = interviewStateCodec;
        this.interviewSpeechSanitizer = interviewSpeechSanitizer;
        this.systemConfigService = systemConfigService;
        this.speakingStreamExecutor = speakingStreamExecutor;
        this.sessionTurnGuard = sessionTurnGuard;
        this.interviewDomainCoordinator = interviewDomainCoordinator;
        this.sessionLifecycleService = sessionLifecycleService;
        this.learningProgressService = learningProgressService;
        this.chatPrepService = chatPrepService;
    }

    @Override
    public AiSpeakingSessionDto createSession(Long userId, String topic, String cefrLevel, String personaRaw,
                                              String responseSchemaRaw, String sessionModeRaw,
                                              String interviewPosition, String experienceLevel,
                                              Long assignmentId) {
        Instant start = Instant.now();
        boolean failed = false;
        AiSpeakingSession session = null;
        try {
            guardActiveSessions(userId);
            enforceSessionCreationCooldown(userId);

            UserLearningProfile profile = profileRepository.findByUserId(userId).orElse(null);
            String resolved = chatPrepService.resolveSessionLevel(cefrLevel, profile);
            SpeakingPersona persona = SpeakingPersona.fromApi(personaRaw);
            SpeakingResponseSchema responseSchema = SpeakingResponseSchema.fromApi(responseSchemaRaw);
            SpeakingSessionMode sessionMode = SpeakingSessionMode.fromApi(sessionModeRaw);
            validateCreateSessionRequest(sessionMode, interviewPosition, experienceLevel, personaRaw, responseSchemaRaw);
            session = buildSpeakingSession(userId, topic, resolved, persona, responseSchema,
                    sessionMode, interviewPosition, experienceLevel, assignmentId);
            session = sessionRepository.save(session);

            if (sessionMode == SpeakingSessionMode.INTERVIEW) {
                String promptVariant = interviewDomainCoordinator.onSessionCreated(session);
                sessionRepository.save(session);
                log.debug("[interview] session {} assigned variant '{}'", session.getId(), promptVariant);
            }

            AiSpeakingChatResponse greeting = generateInitialGreeting(
                    userId, session, topic, resolved, persona, responseSchema, sessionMode);

            return toSessionDto(session, greeting);
        } catch (RuntimeException e) {
            failed = true;
            // If session was already persisted as ACTIVE and greeting failed,
            // mark it ENDED immediately so the next retry is not blocked by guardActiveSessions
            // or the 5-second cooldown finding a phantom ACTIVE session.
            if (session != null && session.getId() != null && session.getStatus() == SessionStatus.ACTIVE) {
                log.warn("[createSession] greeting failed for session {} (user {}) — marking ENDED to unblock retries",
                        session.getId(), userId);
                session.setStatus(SessionStatus.ENDED);
                session.setEndedAt(LocalDateTime.now());
                try {
                    sessionRepository.save(session);
                } catch (Exception saveEx) {
                    log.warn("[createSession] Could not mark session {} as ENDED after greeting failure", session.getId(), saveEx);
                }
            }
            throw e;
        } finally {
            speakingMetrics.recordChatRequest("create_session", failed ? "error" : "ok");
            speakingMetrics.recordChatLatency("create_session", Duration.between(start, Instant.now()));
        }
    }

    private void guardActiveSessions(Long userId) {
        List<AiSpeakingSession> activeSessions =
                sessionRepository.findByUserIdAndStatusOrderByStartedAtAsc(userId, SessionStatus.ACTIVE);
        if (!activeSessions.isEmpty()) {
            log.info("[Session-Guard] Auto-ending {} stale ACTIVE sessions for user {}", activeSessions.size(), userId);
            LocalDateTime now = LocalDateTime.now();
            for (AiSpeakingSession old : activeSessions) {
                old.setStatus(SessionStatus.ENDED);
                old.setEndedAt(now);
            }
            sessionRepository.saveAll(activeSessions);
        }
    }

    private void enforceSessionCreationCooldown(Long userId) {
        List<AiSpeakingSession> recent = sessionRepository.findTop7ByUserIdOrderByStartedAtDesc(userId);
        if (recent.isEmpty()) return;

        AiSpeakingSession last = recent.get(0);
        LocalDateTime lastCreated = last.getStartedAt();
        if (lastCreated == null) return;
        if (java.time.Duration.between(lastCreated, LocalDateTime.now()).toSeconds() >= 5) return;

        // Skip cooldown for instant-failed sessions (greeting error → ENDED within 10s).
        // The comment in createSession's catch block promises retries are unblocked after a
        // greeting failure — this is the enforcement of that promise.
        if (last.getStatus() == SessionStatus.ENDED
                && last.getEndedAt() != null
                && java.time.Duration.between(last.getStartedAt(), last.getEndedAt()).toSeconds() < 10) {
            return;
        }

        throw new ConflictException("Vui lòng chờ vài giây trước khi tạo phiên mới.");
    }

    private void validateCreateSessionRequest(SpeakingSessionMode sessionMode,
                                              String interviewPosition,
                                              String experienceLevel,
                                              String personaRaw,
                                              String responseSchemaRaw) {
        if (sessionMode == SpeakingSessionMode.INTERVIEW) {
            if (interviewPosition == null || interviewPosition.isBlank()) {
                throw new com.deutschflow.common.exception.BadRequestException("Interview mode requires interviewPosition.");
            }
            if (experienceLevel == null || experienceLevel.isBlank()) {
                throw new com.deutschflow.common.exception.BadRequestException("Interview mode requires experienceLevel.");
            }
        }
        if (personaRaw != null && !personaRaw.isBlank()) {
            try {
                SpeakingPersona.valueOf(personaRaw.trim().toUpperCase(java.util.Locale.ROOT));
            } catch (IllegalArgumentException e) {
                throw new com.deutschflow.common.exception.BadRequestException("Invalid persona.");
            }
        }
        if (responseSchemaRaw != null && !responseSchemaRaw.isBlank()) {
            try {
                SpeakingResponseSchema.valueOf(responseSchemaRaw.trim().toUpperCase(java.util.Locale.ROOT));
            } catch (IllegalArgumentException e) {
                throw new com.deutschflow.common.exception.BadRequestException("Invalid responseSchema.");
            }
        }
    }

    private AiSpeakingSession buildSpeakingSession(Long userId,
                                                   String topic,
                                                   String resolved,
                                                   SpeakingPersona persona,
                                                   SpeakingResponseSchema responseSchema,
                                                   SpeakingSessionMode sessionMode,
                                                   String interviewPosition,
                                                   String experienceLevel,
                                                   Long assignmentId) {
        AiSpeakingSession session = AiSpeakingSession.builder()
                .userId(userId)
                .topic(topic)
                .cefrLevel(resolved)
                .persona(persona.name())
                .responseSchema(responseSchema.name())
                .sessionMode(sessionMode.name())
                .interviewPosition(sessionMode == SpeakingSessionMode.INTERVIEW ? interviewPosition : null)
                .experienceLevel(sessionMode == SpeakingSessionMode.INTERVIEW ? experienceLevel : null)
                .assignmentId(assignmentId)
                .status(SessionStatus.ACTIVE)
                .messageCount(0)
                .build();
        if (sessionMode == SpeakingSessionMode.INTERVIEW) {
            InterviewSessionState initialState = interviewOrchestrator.ensureState(null, persona, interviewPosition);
            session.setInterviewStateJson(interviewStateCodec.encode(initialState));
        }
        return session;
    }

    private AiSpeakingChatResponse generateInitialGreeting(
            Long userId,
            AiSpeakingSession sessionRow,
            String topic,
            String cefrLevel,
            SpeakingPersona persona,
            SpeakingResponseSchema responseSchema,
            SpeakingSessionMode sessionMode) {
        UserLearningProfile profile = profileRepository.findByUserId(userId).orElse(defaultProfile());
        List<String> knownInterests = learningProgressService.extractInterests(profile);
        List<WeakPoint> weakPoints = sessionMode == SpeakingSessionMode.INTERVIEW
                ? List.of()
                : adaptiveEngineService.getWeakPoints(userId);

        SpeakingPolicy policy = adaptivePolicyService.computePolicy(userId, sessionRow, profile, knownInterests);
        InterviewPromptContext interviewContext = chatPrepService.buildGreetingInterviewContext(sessionMode, sessionRow, persona);
        String systemPrompt = chatPrepService.buildGreetingSystemPrompt(profile, knownInterests, topic, weakPoints, cefrLevel, policy,
                persona, responseSchema, sessionMode, sessionRow, interviewContext);
        List<ChatMessage> messages = chatPrepService.buildGreetingMessages(systemPrompt, persona, topic, weakPoints, sessionMode,
                sessionRow, interviewContext);
        int greetMaxTokens = chatPrepService.resolveGreetingMaxTokens(userId);

        AiChatCompletionResult result = openAiChatClient.chatCompletion(
                messages, null, systemConfigService.getDouble("ai.temperature", GREETING_TEMPERATURE), greetMaxTokens);
        Long sessionId = sessionRow.getId();
        AiResponseDto parsed = parseGreetingResponse(result, responseSchema, userId, sessionId, policy, systemPrompt,
                cefrLevel, topic, sessionMode, interviewContext, greetMaxTokens);

        AiSpeakingMessage msg = messageRepository.save(AiSpeakingMessage.builder()
                .sessionId(sessionId)
                .role(MessageRole.ASSISTANT)
                .aiSpeechDe(parsed.aiSpeechDe())
                .explanationVi(parsed.explanationVi())
                .assistantAction(parsed.action())
                .assistantFeedback(parsed.feedback())
                .createdAt(LocalDateTime.now())
                .build());

        if (sessionMode == SpeakingSessionMode.INTERVIEW && interviewContext != null) {
            InterviewSessionState state = interviewContext.state();
            state.applyAfterTurn(interviewContext.plan(),
                    new InterviewAnswerAnalysis(false, false, false, false, false, false, false));
            sessionRow.setInterviewStateJson(interviewStateCodec.encode(state));
            sessionRepository.save(sessionRow);
        }

        String interviewPhaseKey = null;
        String interviewHintKey = null;
        if (sessionMode == SpeakingSessionMode.INTERVIEW && interviewContext != null) {
            InterviewTurnPlan plan = interviewContext.plan();
            interviewPhaseKey = plan.phase().name();
        }

        // Return parsed response with correct IDs
        return new AiSpeakingChatResponse(
                msg.getId(),
                sessionId,
                parsed.aiSpeechDe(),
                null,
                parsed.explanationVi(),
                null,
                new AiSpeakingChatResponse.LearningStatus(parsed.newWord(), parsed.userInterestDetected()),
                List.of(),
                null,
                parsed.status(),
                parsed.similarityScore(),
                parsed.feedback(),
                List.of(),
                responseSchema.name(),
                parsed.action(),
                false,
                interviewPhaseKey,
                interviewHintKey
        );
    }

    private AiResponseDto parseGreetingResponse(AiChatCompletionResult result,
                                                SpeakingResponseSchema responseSchema,
                                                Long userId,
                                                Long sessionId,
                                                SpeakingPolicy policy,
                                                String systemPrompt,
                                                String cefrLevel,
                                                String topic,
                                                SpeakingSessionMode sessionMode,
                                                InterviewPromptContext interviewContext,
                                                int greetMaxTokens) {
        AiResponseDto parsedRaw = responseParser.parseWithOutcome(result.content(), responseSchema).dto();
        SpeakingChatPrep greetPrep = sessionMode == SpeakingSessionMode.INTERVIEW && interviewContext != null
                ? new SpeakingChatPrep(userId, sessionId, policy, systemPrompt, cefrLevel, topic, List.of(),
                greetMaxTokens, 0, responseSchema, sessionMode, interviewContext, null, Instant.now())
                : null;
        return greetPrep != null
                ? applyInterviewPostProcessing(parsedRaw, "", greetPrep)
                : parsedRaw;
    }

    @Override
    public AiSpeakingChatResponse chat(Long userId, Long sessionId, String userMessage) {
        Instant chatStart = Instant.now();
        boolean failed = false;
        try {
            if (!sessionTurnGuard.tryAcquire(sessionId)) {
                throw new ConflictException("This interview turn is already being processed.");
            }
            return chatInner(userId, sessionId, userMessage);
        } catch (RuntimeException e) {
            failed = true;
            throw e;
        } finally {
            sessionTurnGuard.release(sessionId);
            speakingMetrics.recordChatRequest("blocking", failed ? "error" : "ok");
            speakingMetrics.recordChatLatency("blocking", Duration.between(chatStart, Instant.now()));
        }
    }

    /**
     * Read DB + quota in a short transaction, call LLM outside any transaction (no JDBC held during latency),
     * persist in a single write transaction — avoids starving {@code DeutschFlowPool} when vocab schedulers run.
     */
    private AiSpeakingChatResponse chatInner(Long userId, Long sessionId, String userMessage) {
        SpeakingChatPrep prep =
                Objects.requireNonNull(transactionTemplate.execute(status -> chatPrepService.prepareSpeakingChatTurn(userId, sessionId, userMessage)));

        AiChatCompletionResult ai = runChatCompletion(prep);
        AiResponseDto parsed = parseAndPostProcess(ai, userMessage, prep);

        return Objects.requireNonNull(transactionTemplate.execute(
                status -> finalizeSpeakingChatPersistence(prep, userMessage, ai, parsed, "SPEAKING_CHAT")));
    }

    private AiChatCompletionResult runChatCompletion(SpeakingChatPrep prep) {
        Double tempConfig = systemConfigService.getDouble("ai.temperature", SPEAKING_CHAT_TEMPERATURE);
        return chatClientFor(prep.sessionMode())
                .chatCompletion(prep.openAiMessages(), null, tempConfig, prep.maxTokens());
    }

    /**
     * Interview mode forces Groq: the structured {@code interview_meta} (analysis + ack/question)
     * parses far more reliably on the hosted model than on the local one. Other modes use the
     * configured primary client ({@link AiChatClientFactory}).
     */
    private OpenAiChatClient chatClientFor(SpeakingSessionMode mode) {
        return mode == SpeakingSessionMode.INTERVIEW ? groqChatClient : openAiChatClient;
    }

    private AiResponseDto parseAndPostProcess(AiChatCompletionResult ai, String userMessage, SpeakingChatPrep prep) {
        AiParseOutcome parseOutcome = responseParser.parseWithOutcome(ai.content(), prep.responseSchema());
        speakingMetrics.recordAiParseOutcome(parseOutcome.status());
        return applyInterviewPostProcessing(parseOutcome.dto(), userMessage, prep);
    }

    private AiResponseDto applyInterviewPostProcessing(AiResponseDto parsedRaw, String userMessage, SpeakingChatPrep prep) {
        AiResponseDto base = new AiResponseDto(
                parsedRaw.aiSpeechDe(),
                parsedRaw.correction(),
                parsedRaw.explanationVi(),
                parsedRaw.grammarPoint(),
                parsedRaw.newWord(),
                parsedRaw.userInterestDetected(),
                AiErrorSanitizer.sanitize(userMessage, parsedRaw.errors()),
                parsedRaw.status(),
                parsedRaw.similarityScore(),
                parsedRaw.feedback(),
                parsedRaw.suggestions(),
                parsedRaw.action(),
                parsedRaw.interviewMeta());
        if (prep.sessionMode() != SpeakingSessionMode.INTERVIEW || prep.interviewContext() == null) {
            return base;
        }
        InterviewTurnPlan plan = prep.interviewContext().plan();
        int userTurn = plan.userTurn();
        String speech;
        if (base.interviewMeta() != null) {
            speech = interviewSpeechSanitizer.composeFromMeta(
                    base.interviewMeta().ackDe(), base.interviewMeta().questionDe(), plan, userTurn);
        } else {
            speech = interviewSpeechSanitizer.sanitize(base.aiSpeechDe(), plan, userTurn);
        }
        return new AiResponseDto(
                speech, base.correction(), base.explanationVi(), base.grammarPoint(), base.newWord(),
                base.userInterestDetected(), base.errors(), base.status(), base.similarityScore(),
                base.feedback(), base.suggestions(), base.action(), base.interviewMeta());
    }

    private AiSpeakingChatResponse finalizeSpeakingChatPersistence(
            SpeakingChatPrep prep,
            String userMessage,
            AiChatCompletionResult ai,
            AiResponseDto parsed,
            String ledgerPurpose) {

        AiSpeakingSession session = loadSessionForUser(prep.userId(), prep.sessionId());
        UserLearningProfile profile = profileRepository.findByUserId(prep.userId()).orElse(null);
        UserLearningProfile effectiveProfile = profile != null ? profile : defaultProfile();

        AiSpeakingMessage userMsg = AiSpeakingMessage.builder()
                .sessionId(prep.sessionId())
                .role(MessageRole.USER)
                .userText(userMessage)
                .build();
        messageRepository.save(userMsg);

        AiSpeakingMessage assistantMsg = AiSpeakingMessage.builder()
                .sessionId(prep.sessionId())
                .role(MessageRole.ASSISTANT)
                .aiSpeechDe(parsed.aiSpeechDe())
                .correction(parsed.correction())
                .explanationVi(parsed.explanationVi())
                .grammarPoint(parsed.grammarPoint())
                .newWord(parsed.newWord())
                .userInterestDetected(parsed.userInterestDetected())
                .assistantAction(parsed.action())
                .assistantFeedback(parsed.feedback())
                .build();
        assistantMsg = messageRepository.save(assistantMsg);

        applyTurnSideEffects(prep, userMessage, parsed, ai, assistantMsg.getId(), effectiveProfile, profile, session, ledgerPurpose);

        AdaptiveMetaDto adaptive = AdaptiveMetaDto.fromPolicyAndResponse(prep.policy(), parsed);
        if (adaptive != null && adaptive.forceRepairBeforeContinue()) {
            speakingMetrics.recordForceRepair();
        }

        String interviewPhaseKey = null;
        String interviewHintKey = null;
        if (prep.sessionMode() == SpeakingSessionMode.INTERVIEW && prep.interviewContext() != null) {
            InterviewTurnPlan plan = prep.interviewContext().plan();
            interviewPhaseKey = plan.phase().name();
            interviewHintKey = switch (plan.directiveType()) {
                case CHALLENGE_EXAMPLE, PROBE_SPECIFIC, STAR_PROMPT -> "expectConcreteExample";
                case INTERRUPT_HOOK -> "answerShorter";
                case CLOSING_ASK -> "closingAsk";
                case CLOSING_ANSWER -> "closingAnswer";
                case CLOSING_FAREWELL -> "interviewEnded";
                default -> null;
            };
        }

        return new AiSpeakingChatResponse(
                assistantMsg.getId(),
                prep.sessionId(),
                parsed.aiSpeechDe(),
                parsed.correction(),
                parsed.explanationVi(),
                parsed.grammarPoint(),
                new AiSpeakingChatResponse.LearningStatus(
                        parsed.newWord(),
                        parsed.userInterestDetected()
                ),
                toErrorItemDtos(parsed.errors()),
                adaptive,
                parsed.status(),
                parsed.similarityScore(),
                parsed.feedback(),
                parsed.suggestions().stream()
                        .map(s -> new AiSpeakingChatResponse.SuggestionDto(
                                s.germanText(),
                                s.vietnameseTranslation(),
                                s.level(),
                                s.whyToUse(),
                                s.usageContext(),
                                s.legoStructure()
                        )).toList(),
                prep.responseSchema().name(),
                parsed.action(),
                session.getStatus() == SessionStatus.ENDED,
                interviewPhaseKey,
                interviewHintKey
        );
    }

    /**
     * Immutable snapshot — session row may change across transactions; IDs + topic/CEFR copied out.
     *
     * <p>Package-private (not {@code private}) so {@link ChatPrepService#prepareSpeakingChatTurn}
     * — which now builds this snapshot — can construct and return it.
     */
    record SpeakingChatPrep(
            long userId,
            long sessionId,
            SpeakingPolicy policy,
            String systemPrompt,
            String cefrLevel,
            String topic,
            List<ChatMessage> openAiMessages,
            int maxTokens,
            int messageCountBaseline,
            SpeakingResponseSchema responseSchema,
            SpeakingSessionMode sessionMode,
            InterviewPromptContext interviewContext,
            InterviewAnswerAnalysis answerAnalysis,
            Instant turnStartedAt
    ) {}

    @Override
    public void chatStream(Long userId, Long sessionId, String userMessage, SseEmitter emitter,
                           AtomicBoolean streamCancelled) {
        Instant start = Instant.now();
        boolean acquired = false;
        boolean failed = false;
        try {
            if (!sessionTurnGuard.tryAcquire(sessionId)) {
                throw new ConflictException("This interview turn is already being processed.");
            }
            acquired = true;
            speakingStreamExecutor.execute(() -> runChatStreamOffServletThread(
                    userId, sessionId, userMessage, emitter, streamCancelled));
        } catch (RuntimeException e) {
            failed = true;
            if (acquired) {
                sessionTurnGuard.release(sessionId);
            }
            throw e;
        } finally {
            speakingMetrics.recordChatRequest("stream_start", failed ? "error" : "ok");
            speakingMetrics.recordChatLatency("stream_start", Duration.between(start, Instant.now()));
        }
    }

    /**
     * Runs on {@code speakingStreamExecutor} so Tomcat threads are not held during Groq/local LLM I/O.
     * DB: short read TX in prepare, LLM outside TX, write TX in finalize (unchanged).
     */
    private void runChatStreamOffServletThread(Long userId, Long sessionId, String userMessage,
                                               SseEmitter emitter, AtomicBoolean streamCancelled) {
        try {
            SpeakingChatPrep prep = transactionTemplate.execute(
                    status -> chatPrepService.prepareSpeakingChatTurn(userId, sessionId, userMessage));
            if (prep == null) {
                emitter.completeWithError(new IllegalStateException("prepareSpeakingChatTurn returned null"));
                return;
            }

            Instant streamStart = Instant.now();
            boolean finished = streamChatCompletion(prep, userMessage, emitter, streamCancelled);
            speakingMetrics.recordChatLatency("stream", Duration.between(streamStart, Instant.now()));
            if (!finished) {
                handleStreamCancelled(emitter);
            }
        } catch (Exception ex) {
            log.error("[SSE] Stream error", ex);
            emitter.completeWithError(ex);
        } finally {
            sessionTurnGuard.release(sessionId);
        }
    }

    private boolean streamChatCompletion(SpeakingChatPrep prep,
                                         String userMessage,
                                         SseEmitter emitter,
                                         AtomicBoolean streamCancelled) {
        Double tempConfig = systemConfigService.getDouble("ai.temperature", SPEAKING_CHAT_TEMPERATURE);
        return chatClientFor(prep.sessionMode()).chatCompletionStream(prep.openAiMessages(), null, tempConfig, prep.maxTokens(),
                token -> {
                    try {
                        emitter.send(SseEmitter.event().name("token").data(token));
                    } catch (Exception e) {
                        log.warn("[SSE] Failed to send token: {}", e.getMessage());
                    }
                },
                ai -> handleStreamCompletion(prep, userMessage, emitter, ai),
                streamCancelled);
    }

    private void handleStreamCompletion(SpeakingChatPrep prep,
                                        String userMessage,
                                        SseEmitter emitter,
                                        AiChatCompletionResult ai) {
        try {
            AiResponseDto parsed = parseAndPostProcess(ai, userMessage, prep);
            AiSpeakingChatResponse donePayload = Objects.requireNonNull(
                    transactionTemplate.execute(status ->
                            finalizeSpeakingChatPersistence(prep, userMessage, ai, parsed, "SPEAKING_STREAM")));
            speakingMetrics.recordChatRequest("stream", "ok");
            emitter.send(SseEmitter.event().name("done")
                    .data(objectMapper.writeValueAsString(donePayload)));
            emitter.complete();
        } catch (Exception ex) {
            log.error("[SSE] Error in onComplete handler", ex);
            speakingMetrics.recordChatRequest("stream", "error");
            emitter.completeWithError(ex);
        }
    }

    private void handleStreamCancelled(SseEmitter emitter) {
        log.debug("[SSE] AI chat stream aborted (timeout/cancel); skipping persist");
        speakingMetrics.recordChatRequest("stream", "cancelled");
        try {
            emitter.send(SseEmitter.event().name("error").data("Stream cancelled."));
        } catch (Exception sendEx) {
            log.trace("[SSE] Could not send cancel error event: {}", sendEx.getMessage());
        }
        try {
            emitter.complete();
        } catch (Exception completeEx) {
            log.trace("[SSE] Emitter already completed: {}", completeEx.getMessage());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<AiSpeakingMessageDto> getMessages(Long userId, Long sessionId) {
        loadSessionForUser(userId, sessionId); // validates ownership
        List<AiSpeakingMessage> messages = messageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
        List<Long> assistantIds = messages.stream()
                .filter(m -> m.getRole() == MessageRole.ASSISTANT)
                .map(AiSpeakingMessage::getId)
                .toList();
        Map<Long, List<UserGrammarError>> byMsgId = assistantIds.isEmpty()
                ? Map.of()
                : grammarErrorRepository.findByMessageIdIn(assistantIds).stream()
                .collect(Collectors.groupingBy(UserGrammarError::getMessageId));
        return messages.stream()
                .map(m -> {
                    List<UserGrammarError> ge = m.getRole() == MessageRole.ASSISTANT
                            ? byMsgId.getOrDefault(m.getId(), List.of())
                            : List.of();
                    return toMessageDto(m, ge);
                })
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AiSpeakingSessionDto> getSessions(Long userId, Pageable pageable) {
        return sessionRepository.findByUserId(userId, pageable)
                .map(this::toSessionDto);
    }

    @Override
    public AiSpeakingSessionDto endSession(Long userId, Long sessionId) {
        AiSpeakingSession finalSession = sessionLifecycleService.closeSession(userId, sessionId);
        return toSessionDto(finalSession);
    }

    @Override
    public com.deutschflow.speaking.dto.ConversationReportDto getConversationReport(Long userId, Long sessionId) {
        AiSpeakingSession session = loadSessionForUser(userId, sessionId);
        return conversationEvaluationService.parseReport(session);
    }

    // --- Private helpers ---

    private AiSpeakingSession loadSessionForUser(Long userId, Long sessionId) {
        AiSpeakingSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new NotFoundException("Session not found: " + sessionId));
        if (!session.getUserId().equals(userId)) {
            throw new NotFoundException("Session not found: " + sessionId);
        }
        return session;
    }

    private void applyTurnSideEffects(SpeakingChatPrep prep,
                                      String userMessage,
                                      AiResponseDto parsed,
                                      AiChatCompletionResult ai,
                                      Long assistantMessageId,
                                      UserLearningProfile effectiveProfile,
                                      UserLearningProfile profile,
                                      AiSpeakingSession session,
                                      String ledgerPurpose) {
        grammarPersistenceService.persistGrammarFeedback(prep.userId(), prep.sessionId(), assistantMessageId, userMessage, parsed, effectiveProfile);
        learningProgressService.updateUserLearningProgress(prep.userId(), parsed);
        recordAssistantTurnMetrics(parsed);

        try {
            if (ai.usage() != null) {
                aiUsageLedgerService.record(
                        prep.userId(),
                        ai.provider(),
                        ai.model(),
                        ai.usage().promptTokens(),
                        ai.usage().completionTokens(),
                        ai.usage().totalTokens(),
                        ledgerPurpose,
                        RequestContext.requestIdOrNull(),
                        prep.sessionId()
                );
            }
        } catch (Exception e) {
            log.warn("Skip token usage ledger due to error: {}", e.getMessage());
        }

        if (parsed.userInterestDetected() != null && !parsed.userInterestDetected().isBlank() && profile != null) {
            learningProgressService.mergeInterest(profile, parsed.userInterestDetected());
        }

        turnEvaluatorService.recordTurn(prep.userId(), prep.sessionId(), assistantMessageId, parsed, prep.policy());

        trainingDatasetService.recordConversationTurn(
                prep.userId(), prep.sessionId(), prep.cefrLevel(), prep.topic(),
                userMessage, parsed, prep.systemPrompt(), assistantMessageId, ai.provider()
        );

        session.setLastActivityAt(LocalDateTime.now());
        session.setMessageCount(prep.messageCountBaseline() + 2);

        if (prep.sessionMode() == SpeakingSessionMode.INTERVIEW && prep.interviewContext() != null) {
            InterviewSessionState state = prep.interviewContext().state();
            InterviewAnswerAnalysis analysis = prep.answerAnalysis() != null ? prep.answerAnalysis()
                    : new InterviewAnswerAnalysis(false, false, false, false, false, false, false);
            int prevPhaseNum = state.getPhase();
            InterviewPhase turnPhase = prep.interviewContext().plan().phase();
            state.applyAfterTurn(prep.interviewContext().plan(), analysis);

            // Content-aware progression: record whether this turn met its phase goal so the next
            // turn can advance early. Prefer the LLM's read; fall back to a deterministic heuristic.
            var interviewMeta = parsed != null ? parsed.interviewMeta() : null;
            var llmAnalysis = interviewMeta != null ? interviewMeta.analysis() : null;
            boolean phaseGoalMet = llmAnalysis != null
                    ? llmAnalysis.phaseGoalMet()
                    : PhaseProgressionPolicy.deterministicGoalMet(turnPhase, state);
            state.setLastPhaseGoalMet(phaseGoalMet);
            session.setInterviewStateJson(interviewStateCodec.encode(state));

            int turnIndex = prep.messageCountBaseline() / 2;
            String aiFollowUp = parsed != null ? parsed.aiSpeechDe() : null;
            int latencyMs = (int) Math.max(0L,
                    Duration.between(prep.turnStartedAt(), Instant.now()).toMillis());
            interviewDomainCoordinator.onTurnCompleted(
                    prep.sessionId(), prep.userId(), turnIndex,
                    prep.interviewContext().plan(), userMessage, aiFollowUp, analysis, latencyMs);

            // Phase transition fires on an actual phase change (was a buggy fromUserTurn recompute, §13.2).
            if (prevPhaseNum > 0 && prevPhaseNum != turnPhase.number()) {
                String industry = interviewDomainCoordinator.personaRegistry()
                        .industryFor(session.getPersona());
                interviewDomainCoordinator.onPhaseTransition(
                        prep.sessionId(), PhaseProgressionPolicy.fromNumber(prevPhaseNum).name(), industry, prep.cefrLevel());
            }
        }

        SpeakingSessionMode currentMode = SpeakingSessionMode.fromApi(session.getSessionMode());
        if (currentMode == SpeakingSessionMode.INTERVIEW
                && prep.interviewContext() != null
                && prep.interviewContext().plan().directiveType() == InterviewDirectiveType.CLOSING_FAREWELL) {
            log.info("Interview session {} ended via CLOSING_FAREWELL", prep.sessionId());
            session.setStatus(SessionStatus.ENDED);
            session.setEndedAt(LocalDateTime.now());
        }

        sessionRepository.save(session);

        try { xpService.awardSpeakingTurn(prep.userId(), prep.sessionId(), assistantMessageId); }
        catch (Exception xpEx) { log.debug("[XP] awardSpeakingTurn skipped: {}", xpEx.getMessage()); }
    }

    private void recordAssistantTurnMetrics(AiResponseDto parsed) {
        boolean noMajor = parsed.errors() == null || parsed.errors().stream().noneMatch(e -> {
            String s = e.severity() == null ? "" : e.severity().toUpperCase(Locale.ROOT);
            return s.contains("MAJOR") || s.contains("BLOCKING");
        });
        speakingMetrics.recordTurnAccuracy(noMajor);
        speakingMetrics.recordErrorsEmitted(parsed.errors());
    }

    private List<ErrorItemDto> toErrorItemDtos(List<ErrorItem> items) {
        if (items == null || items.isEmpty()) return List.of();
        return items.stream().map(e -> new ErrorItemDto(
                e.errorCode(),
                e.severity(),
                e.confidence(),
                e.wrongSpan(),
                e.correctedSpan(),
                e.ruleViShort(),
                e.exampleCorrectDe()
        )).toList();
    }

    private ErrorItemDto toErrorItemDto(UserGrammarError e) {
        String code = e.getErrorCode() != null ? e.getErrorCode() : e.getGrammarPoint();
        return new ErrorItemDto(
                code,
                e.getSeverity(),
                e.getConfidence() == null ? null : e.getConfidence().doubleValue(),
                e.getWrongSpan(),
                e.getCorrectedSpan(),
                e.getRuleViShort(),
                e.getExampleCorrectDe()
        );
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

    private AiSpeakingSessionDto toSessionDto(AiSpeakingSession s) {
        return toSessionDto(s, null);
    }

    private AiSpeakingSessionDto toSessionDto(AiSpeakingSession s, AiSpeakingChatResponse initialAiMessage) {
        // Map internal enum to frontend-compatible status string
        String statusStr = (s.getStatus() == SessionStatus.ENDED) ? "COMPLETED" : "IN_PROGRESS";
        return new AiSpeakingSessionDto(
                s.getId(),
                s.getTopic(),
                s.getCefrLevel(),
                s.getPersona(),
                s.getResponseSchema(),
                s.getSessionMode(),
                statusStr,
                s.getStartedAt(),
                s.getLastActivityAt(),
                s.getEndedAt(),
                s.getMessageCount(),
                initialAiMessage,
                s.getInterviewPosition(),
                s.getExperienceLevel(),
                s.getInterviewReportJson());
    }

    private AiSpeakingMessageDto toMessageDto(AiSpeakingMessage m, List<UserGrammarError> grammarRows) {
        List<ErrorItemDto> errors = grammarRows.stream()
                .map(this::toErrorItemDto)
                .toList();
        return new AiSpeakingMessageDto(
                m.getId(), m.getRole().name(), m.getUserText(),
                m.getAiSpeechDe(), m.getCorrection(), m.getExplanationVi(),
                m.getGrammarPoint(), m.getNewWord(), m.getUserInterestDetected(),
                m.getAssistantAction(), m.getAssistantFeedback(),
                m.getCreatedAt(),
                errors);
    }
}
