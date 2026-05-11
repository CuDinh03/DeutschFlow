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
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.ai.SystemPromptBuilder;
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
import com.deutschflow.speaking.util.SpeakingCefrSupport;
import com.deutschflow.speaking.entity.AiSpeakingMessage;
import com.deutschflow.speaking.entity.AiSpeakingMessage.MessageRole;
import com.deutschflow.speaking.entity.AiSpeakingSession;
import com.deutschflow.speaking.entity.AiSpeakingSession.SessionStatus;
import com.deutschflow.speaking.domain.GrammarErrorSeverity;
import com.deutschflow.speaking.domain.SpeakingPriority;
import com.deutschflow.speaking.entity.UserErrorObservation;
import com.deutschflow.speaking.entity.UserErrorSkill;
import com.deutschflow.speaking.entity.UserGrammarError;
import com.deutschflow.speaking.metrics.SpeakingMetrics;
import com.deutschflow.speaking.repository.AiSpeakingMessageRepository;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.deutschflow.speaking.repository.UserErrorObservationRepository;
import com.deutschflow.speaking.repository.UserErrorSkillRepository;
import com.deutschflow.speaking.repository.UserGrammarErrorRepository;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.entity.UserLearningProgress;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.user.repository.UserLearningProgressRepository;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.common.quota.RequestContext;
import com.deutschflow.gamification.service.XpService;
import com.deutschflow.training.service.TrainingDatasetService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiSpeakingServiceImpl implements AiSpeakingService {

    /** Lower-variance JSON / tutor replies for structured V1/V2. */
    private static final double SPEAKING_CHAT_TEMPERATURE = 0.35;
    /** Cap completion tokens per turn (quota snapshot may be lower). */
    private static final int SPEAKING_MAX_COMPLETION_TOKENS = 512;
    /** Initial greeting: warmer than chat but still structured JSON. */
    private static final double GREETING_TEMPERATURE = 0.5;

    private final TransactionTemplate transactionTemplate;
    private final AiSpeakingSessionRepository sessionRepository;
    private final AiSpeakingMessageRepository messageRepository;
    private final UserLearningProfileRepository profileRepository;
    private final UserGrammarErrorRepository grammarErrorRepository;
    private final OpenAiChatClient openAiChatClient;
    private final SystemPromptBuilder promptBuilder;
    private final AiResponseParser responseParser;
    private final ObjectMapper objectMapper;
    private final UserErrorObservationRepository userErrorObservationRepository;
    private final UserErrorSkillRepository userErrorSkillRepository;
    private final UserLearningProgressRepository progressRepository;
    private final UserRepository userRepository;
    private final ReviewSchedulerService reviewSchedulerService;
    private final SpeakingMetrics speakingMetrics;
    private final AdaptivePolicyService adaptivePolicyService;
    private final TurnEvaluatorService turnEvaluatorService;
    private final QuotaService quotaService;
    private final AiUsageLedgerService aiUsageLedgerService;
    private final TrainingDatasetService trainingDatasetService;
    private final XpService xpService;
    private final InterviewEvaluationService interviewEvaluationService;
    private final com.deutschflow.system.service.SystemConfigService systemConfigService;

    @Override
    public AiSpeakingSessionDto createSession(Long userId, String topic, String cefrLevel, String personaRaw,
                                              String responseSchemaRaw, String sessionModeRaw,
                                              String interviewPosition, String experienceLevel) {
        // ── Guard 1: Auto-end any existing ACTIVE sessions for this user ──
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

        // ── Guard 2: Rate limit — block if last session was created < 5s ago ──
        List<AiSpeakingSession> recent = sessionRepository.findTop7ByUserIdOrderByStartedAtDesc(userId);
        if (!recent.isEmpty()) {
            LocalDateTime lastCreated = recent.get(0).getStartedAt();
            if (lastCreated != null && java.time.Duration.between(lastCreated, LocalDateTime.now()).toSeconds() < 5) {
                throw new ConflictException("Vui lòng chờ vài giây trước khi tạo phiên mới.");
            }
        }

        UserLearningProfile p = profileRepository.findByUserId(userId).orElse(null);
        String resolved =
                (cefrLevel == null || cefrLevel.isBlank())
                        ? SpeakingCefrSupport.floorPracticeBand(p)
                        : SpeakingCefrSupport.clampToProfileRange(cefrLevel, p);
        SpeakingPersona persona = SpeakingPersona.fromApi(personaRaw);
        SpeakingResponseSchema responseSchema = SpeakingResponseSchema.fromApi(responseSchemaRaw);
        SpeakingSessionMode sessionMode = SpeakingSessionMode.fromApi(sessionModeRaw);
        AiSpeakingSession session = AiSpeakingSession.builder()
                .userId(userId)
                .topic(topic)
                .cefrLevel(resolved)
                .persona(persona.name())
                .responseSchema(responseSchema.name())
                .sessionMode(sessionMode.name())
                .interviewPosition(sessionMode == SpeakingSessionMode.INTERVIEW ? interviewPosition : null)
                .experienceLevel(sessionMode == SpeakingSessionMode.INTERVIEW ? experienceLevel : null)
                .status(SessionStatus.ACTIVE)
                .messageCount(0)
                .build();
        session = sessionRepository.save(session);

        // Tự động sinh lời chào cá nhân hóa
        AiSpeakingChatResponse greeting =
                generateInitialGreeting(userId, session.getId(), topic, resolved, persona, responseSchema, sessionMode);

        return toSessionDto(session, greeting);
    }

    private AiSpeakingChatResponse generateInitialGreeting(
            Long userId,
            Long sessionId,
            String topic,
            String cefrLevel,
            SpeakingPersona persona,
            SpeakingResponseSchema responseSchema,
            SpeakingSessionMode sessionMode) {
        AiSpeakingSession sessionRow = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new NotFoundException("Session not found"));
        UserLearningProfile profile = profileRepository.findByUserId(userId).orElse(defaultProfile());
        List<String> knownInterests = extractInterests(profile);
        List<WeakPoint> weakPoints = grammarErrorRepository.findTopWeakPoints(userId, PageRequest.of(0, 5));

        SpeakingPolicy policy = adaptivePolicyService.computePolicy(userId, sessionRow, profile, knownInterests);
        String systemPrompt = policy.enabled()
                ? promptBuilder.buildSystemPrompt(
                profile, knownInterests, topic, weakPoints, cefrLevel, policy, persona, responseSchema, sessionMode)
                : promptBuilder.buildSystemPrompt(
                profile, knownInterests, topic, weakPoints, cefrLevel, persona, responseSchema, sessionMode);

        // Specialized instruction for greeting — pass null if no industry so persona can differentiate
        String industry = profile.getIndustry() != null && !profile.getIndustry().isBlank() ? profile.getIndustry() : null;
        String weakPointsStr = weakPoints.stream().map(WeakPoint::grammarPoint).collect(Collectors.joining(", "));
        String greetingInstruction = persona.buildGreetingInstruction(topic, industry, weakPointsStr, sessionMode,
                sessionRow.getInterviewPosition());

        List<ChatMessage> messages = List.of(
                new ChatMessage("system", systemPrompt),
                new ChatMessage("user", greetingInstruction)
        );

        var greetSnapshot = quotaService.assertAllowed(userId, Instant.now(), 1L);
        int maxTokensConfig = systemConfigService.getInteger("ai.maxTokens", SPEAKING_MAX_COMPLETION_TOKENS);
        int greetMaxTokens = (int) Math.max(1L,
                Math.min(maxTokensConfig, greetSnapshot.remainingThisMonth()));

        Double tempConfig = systemConfigService.getDouble("ai.temperature", GREETING_TEMPERATURE);
        AiChatCompletionResult result = openAiChatClient.chatCompletion(
                messages, null, tempConfig, greetMaxTokens);
        AiResponseDto parsed = responseParser.parseWithOutcome(result.content(), responseSchema).dto();

        // Save AI message
        AiSpeakingMessage msg = AiSpeakingMessage.builder()
                .sessionId(sessionId)
                .role(MessageRole.ASSISTANT)
                .aiSpeechDe(parsed.aiSpeechDe())
                .explanationVi(parsed.explanationVi())
                .assistantAction(parsed.action())
                .assistantFeedback(parsed.feedback())
                .createdAt(LocalDateTime.now())
                .build();
        messageRepository.save(msg);

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
                parsed.action()
        );
    }

    @Override
    public AiSpeakingChatResponse chat(Long userId, Long sessionId, String userMessage) {
        Instant chatStart = Instant.now();
        boolean failed = false;
        try {
            return chatInner(userId, sessionId, userMessage);
        } catch (RuntimeException e) {
            failed = true;
            throw e;
        } finally {
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
                Objects.requireNonNull(transactionTemplate.execute(status -> prepareSpeakingChatTurn(userId, sessionId, userMessage)));

        Double tempConfig = systemConfigService.getDouble("ai.temperature", SPEAKING_CHAT_TEMPERATURE);
        AiChatCompletionResult ai = openAiChatClient.chatCompletion(
                prep.openAiMessages(), null, tempConfig, prep.maxTokens());

        AiParseOutcome parseOutcome = responseParser.parseWithOutcome(ai.content(), prep.responseSchema());
        speakingMetrics.recordAiParseOutcome(parseOutcome.status());
        AiResponseDto parsedRaw = parseOutcome.dto();
        AiResponseDto parsed = new AiResponseDto(
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
                parsedRaw.action()
        );

        return Objects.requireNonNull(transactionTemplate.execute(
                status -> finalizeSpeakingChatPersistence(prep, userMessage, ai, parsed, "SPEAKING_CHAT")));
    }

    private SpeakingChatPrep prepareSpeakingChatTurn(long userId, long sessionId, String userMessage) {
        AiSpeakingSession session = loadSessionForUser(userId, sessionId);
        if (session.getStatus() == SessionStatus.ENDED) {
            throw new ConflictException("This session has already ended.");
        }

        UserLearningProfile profile = profileRepository.findByUserId(userId).orElse(null);
        List<String> knownInterests = extractInterests(profile);
        List<WeakPoint> weakPoints = grammarErrorRepository.findTopWeakPoints(
                userId, PageRequest.of(0, 5));

        List<AiSpeakingMessage> recentMessages =
                messageRepository.findTop10BySessionIdOrderByCreatedAtDesc(sessionId);
        Collections.reverse(recentMessages);
        // Interview mode needs more context for phase tracking
        SpeakingSessionMode sessionMode = SpeakingSessionMode.fromApi(session.getSessionMode());
        int maxHistory = sessionMode == SpeakingSessionMode.INTERVIEW ? 10 : 6;
        if (recentMessages.size() > maxHistory) {
            recentMessages = new ArrayList<>(recentMessages.subList(recentMessages.size() - maxHistory, recentMessages.size()));
        }

        UserLearningProfile effectiveProfile = profile != null ? profile : defaultProfile();
        SpeakingPersona persona = SpeakingPersona.fromApi(session.getPersona());
        SpeakingResponseSchema responseSchema = SpeakingResponseSchema.fromApi(session.getResponseSchema());
        SpeakingPolicy policy = adaptivePolicyService.computePolicy(userId, session, effectiveProfile, knownInterests);
        String systemPrompt = policy.enabled()
                ? promptBuilder.buildSystemPrompt(
                effectiveProfile, knownInterests, session.getTopic(), weakPoints, session.getCefrLevel(), policy, persona, responseSchema, sessionMode,
                session.getInterviewPosition(), session.getExperienceLevel(), session.getMessageCount())
                : promptBuilder.buildSystemPrompt(
                effectiveProfile, knownInterests, session.getTopic(), weakPoints, session.getCefrLevel(), persona, responseSchema, sessionMode);

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

        var snapshot = quotaService.assertAllowed(userId, Instant.now(), 1L);
        int maxTokensConfig = systemConfigService.getInteger("ai.maxTokens", SPEAKING_MAX_COMPLETION_TOKENS);
        int maxTokens = (int) Math.max(1L,
                Math.min(maxTokensConfig, snapshot.remainingThisMonth()));

        return new SpeakingChatPrep(
                userId,
                sessionId,
                policy,
                systemPrompt,
                session.getCefrLevel(),
                session.getTopic(),
                List.copyOf(openAiMessages),
                maxTokens,
                session.getMessageCount(),
                responseSchema);
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

        persistGrammarFeedback(prep.userId(), prep.sessionId(), assistantMsg.getId(), userMessage, parsed, effectiveProfile);
        updateUserLearningProgress(prep.userId(), parsed);
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
            mergeInterest(profile, parsed.userInterestDetected());
        }

        turnEvaluatorService.recordTurn(prep.userId(), prep.sessionId(), assistantMsg.getId(), parsed, prep.policy());

        trainingDatasetService.recordConversationTurn(
                prep.userId(), prep.sessionId(), prep.cefrLevel(), prep.topic(),
                userMessage, parsed, prep.systemPrompt(), assistantMsg.getId(), ai.provider()
        );

        session.setLastActivityAt(LocalDateTime.now());
        session.setMessageCount(prep.messageCountBaseline() + 2);
        sessionRepository.save(session);

        // Award XP for speaking turn (non-blocking: catch any failure)
        try { xpService.awardSpeakingTurn(prep.userId(), prep.sessionId(), assistantMsg.getId()); }
        catch (Exception xpEx) { log.debug("[XP] awardSpeakingTurn skipped: {}", xpEx.getMessage()); }

        AdaptiveMetaDto adaptive = AdaptiveMetaDto.fromPolicyAndResponse(prep.policy(), parsed);
        if (adaptive != null && adaptive.forceRepairBeforeContinue()) {
            speakingMetrics.recordForceRepair();
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
                parsed.action()
        );
    }

    /** Immutable snapshot — session row may change across transactions; IDs + topic/CEFR copied out. */
    private record SpeakingChatPrep(
            long userId,
            long sessionId,
            SpeakingPolicy policy,
            String systemPrompt,
            String cefrLevel,
            String topic,
            List<ChatMessage> openAiMessages,
            int maxTokens,
            int messageCountBaseline,
            SpeakingResponseSchema responseSchema
    ) {}

    @Override
    public void chatStream(Long userId, Long sessionId, String userMessage, SseEmitter emitter,
                           AtomicBoolean streamCancelled) {
        try {
            SpeakingChatPrep prep = transactionTemplate.execute(
                    status -> prepareSpeakingChatTurn(userId, sessionId, userMessage));
            if (prep == null) {
                emitter.completeWithError(new IllegalStateException("prepareSpeakingChatTurn returned null"));
                return;
            }

            Instant streamStart = Instant.now();

            Double tempConfig = systemConfigService.getDouble("ai.temperature", SPEAKING_CHAT_TEMPERATURE);
            boolean finished = openAiChatClient.chatCompletionStream(prep.openAiMessages(), null, tempConfig, prep.maxTokens(),
                    token -> {
                        try {
                            emitter.send(SseEmitter.event().name("token").data(token));
                        } catch (Exception e) {
                            log.warn("[SSE] Failed to send token: {}", e.getMessage());
                        }
                    },
                    (ai) -> {
                        // Parse + metrics outside JDBC; persist in one transaction (reuse blocking-chat path).
                        try {
                            AiParseOutcome parseOutcomeStream =
                                    responseParser.parseWithOutcome(ai.content(), prep.responseSchema());
                            speakingMetrics.recordAiParseOutcome(parseOutcomeStream.status());
                            AiResponseDto parsedRaw = parseOutcomeStream.dto();
                            AiResponseDto parsed = new AiResponseDto(
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
                                    parsedRaw.action()
                            );

                            AiSpeakingChatResponse donePayload = Objects.requireNonNull(
                                    transactionTemplate.execute(status ->
                                            finalizeSpeakingChatPersistence(
                                                    prep, userMessage, ai, parsed, "SPEAKING_STREAM")));
                            speakingMetrics.recordChatRequest("stream", "ok");

                            emitter.send(SseEmitter.event().name("done")
                                    .data(objectMapper.writeValueAsString(donePayload)));
                            emitter.complete();
                        } catch (Exception ex) {
                            log.error("[SSE] Error in onComplete handler", ex);
                            speakingMetrics.recordChatRequest("stream", "error");
                            emitter.completeWithError(ex);
                        }
                    },
                    streamCancelled);
            speakingMetrics.recordChatLatency("stream", Duration.between(streamStart, Instant.now()));
            if (!finished) {
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
        } catch (Exception ex) {
            log.error("[SSE] Stream setup error", ex);
            emitter.completeWithError(ex);
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
        // ── PHA 1: Đóng session (transaction ngắn ~30ms) ──
        // Giữ DB connection chỉ để đọc + update status → commit → trả connection về pool
        AiSpeakingSession closedSession = Objects.requireNonNull(
                transactionTemplate.execute(status -> {
                    AiSpeakingSession s = loadSessionForUser(userId, sessionId);
                    if (s.getStatus() == SessionStatus.ENDED) {
                        throw new ConflictException("This session has already ended.");
                    }
                    s.setStatus(SessionStatus.ENDED);
                    s.setEndedAt(LocalDateTime.now());
                    return sessionRepository.save(s);
                }));
        // → Connection TRẢ VỀ pool ✅

        // ── PHA 2: Gọi Groq nếu INTERVIEW (5-15s, KHÔNG giữ DB connection) ──
        String report = null;
        if ("INTERVIEW".equals(closedSession.getSessionMode())) {
            try {
                report = interviewEvaluationService.generateReport(closedSession, userId);
            } catch (Exception e) {
                log.warn("Failed to generate interview report for session {}: {}", sessionId, e.getMessage());
            }
        }

        // ── PHA 3: Lưu report + award XP (transaction ngắn ~30ms) ──
        final String finalReport = report;
        AiSpeakingSession finalSession = Objects.requireNonNull(
                transactionTemplate.execute(status -> {
                    AiSpeakingSession s = sessionRepository.findById(sessionId)
                            .orElseThrow(() -> new NotFoundException("Session not found: " + sessionId));
                    if (finalReport != null) {
                        s.setInterviewReportJson(finalReport);
                        s = sessionRepository.save(s);
                    }
                    // Award XP for session completion (non-blocking)
                    try { xpService.awardSessionComplete(userId, sessionId); }
                    catch (Exception xpEx) { log.debug("[XP] awardSessionComplete skipped: {}", xpEx.getMessage()); }
                    return s;
                }));
        // → Connection TRẢ VỀ pool ✅

        return toSessionDto(finalSession);
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

    private List<String> extractInterests(UserLearningProfile profile) {
        if (profile == null || profile.getInterestsJson() == null || profile.getInterestsJson().isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(profile.getInterestsJson(), new TypeReference<List<String>>() {});
        } catch (Exception e) {
            log.warn("Failed to parse interestsJson for user profile: {}", e.getMessage());
            return List.of();
        }
    }

    private void mergeInterest(UserLearningProfile profile, String newInterest) {
        try {
            Set<String> updated = new LinkedHashSet<>(extractInterests(profile));
            updated.add(newInterest.trim());
            profile.setInterestsJson(objectMapper.writeValueAsString(updated));
            profileRepository.save(profile);
        } catch (Exception e) {
            log.warn("Failed to merge interest '{}': {}", newInterest, e.getMessage());
        }
    }

    private void persistGrammarFeedback(Long userId, Long sessionId, Long assistantMessageId,
                                        String userMessage, AiResponseDto parsed,
                                        UserLearningProfile profile) {
        if (!parsed.errors().isEmpty()) {
            for (ErrorItem err : parsed.errors()) {
                saveStructuredGrammarError(userId, sessionId, assistantMessageId, userMessage, err, profile);
            }
        } else if (parsed.correction() != null && parsed.grammarPoint() != null) {
            saveLegacyGrammarError(userId, sessionId, assistantMessageId,
                    parsed.grammarPoint(), userMessage, parsed.correction(), profile);
        }
    }

    private void saveStructuredGrammarError(Long userId, Long sessionId, Long messageId,
                                            String userMessage, ErrorItem err,
                                            UserLearningProfile profile) {
        try {
            if (grammarErrorRepository.existsByMessageIdAndErrorCode(messageId, err.errorCode())) {
                return;
            }
            String cefrLevel = (profile != null && profile.getTargetLevel() != null)
                    ? profile.getTargetLevel().name() : null;
            String correctionText = err.correctedSpan() != null ? err.correctedSpan()
                    : err.exampleCorrectDe();
            String sev = GrammarErrorSeverity.normalizeToStored(
                    err.severity() != null ? err.severity() : GrammarErrorSeverity.MINOR.name());
            LocalDateTime now = LocalDateTime.now();
            grammarErrorRepository.save(UserGrammarError.builder()
                    .userId(userId)
                    .sessionId(sessionId)
                    .messageId(messageId)
                    .grammarPoint(err.errorCode())
                    .errorCode(err.errorCode())
                    .confidence(toStoredConfidence(err.confidence()))
                    .wrongSpan(err.wrongSpan())
                    .correctedSpan(err.correctedSpan())
                    .ruleViShort(err.ruleViShort())
                    .exampleCorrectDe(err.exampleCorrectDe())
                    .repairStatus("OPEN")
                    .originalText(userMessage)
                    .correctionText(correctionText)
                    .severity(sev)
                    .cefrLevel(cefrLevel)
                    .createdAt(now)
                    .build());

            userErrorObservationRepository.save(UserErrorObservation.builder()
                    .userId(userId)
                    .messageId(messageId)
                    .sessionId(sessionId)
                    .errorCode(err.errorCode())
                    .severity(sev)
                    .confidence(toStoredConfidence(err.confidence()))
                    .wrongSpan(err.wrongSpan())
                    .correctedSpan(err.correctedSpan())
                    .ruleViShort(err.ruleViShort())
                    .exampleCorrectDe(err.exampleCorrectDe())
                    .createdAt(now)
                    .build());

            upsertUserErrorSkill(userId, err.errorCode(), sev, now);
            reviewSchedulerService.onMajorObservation(userId, err.errorCode(), sev);
        } catch (Exception e) {
            log.warn("Failed to save structured grammar error: {}", e.getMessage());
        }
    }

    private void upsertUserErrorSkill(Long userId, String errorCode, String severity, LocalDateTime now) {
        if (errorCode == null || errorCode.isBlank()) {
            return;
        }
        String code = errorCode.trim();
        Optional<UserErrorSkill> opt = userErrorSkillRepository.findByUserIdAndErrorCode(userId, code);
        if (opt.isEmpty()) {
            // Brand new error
            userErrorSkillRepository.save(UserErrorSkill.builder()
                    .userId(userId)
                    .errorCode(code)
                    .totalCount(1)
                    .lastSeenAt(now)
                    .lastSeverity(severity)
                    .openCount(1)
                    .resolvedCount(0)
                    .priorityScore(BigDecimal.valueOf(SpeakingPriority.skillScore(1, now, severity)))
                    .build());
        } else {
            UserErrorSkill s = opt.get();
            boolean wasFullyResolved = s.getOpenCount() <= 0 && s.getResolvedCount() > 0;
            long daysSinceLastSeen = s.getLastSeenAt() != null
                    ? java.time.temporal.ChronoUnit.DAYS.between(s.getLastSeenAt().toLocalDate(), now.toLocalDate())
                    : 0;

            if (wasFullyResolved && daysSinceLastSeen >= 7) {
                // REGRESSION: error recurs after being resolved for ≥7 days
                // Do NOT increment totalCount — this is not a "new" error
                s.setLastSeenAt(now);
                s.setLastSeverity(severity);
                s.setOpenCount(1);
                s.setResolvedCount(Math.max(0, s.getResolvedCount() - 1));
                s.setPriorityScore(BigDecimal.valueOf(
                        SpeakingPriority.skillScore(s.getTotalCount(), now, severity)));
                userErrorSkillRepository.save(s);
                // Schedule a new review task for this regression
                reviewSchedulerService.onMajorObservation(userId, code, severity);
                log.info("[REGRESSION] User {} error {} reopened after {} days", userId, code, daysSinceLastSeen);
            } else {
                // Normal: error still open or recurs quickly — count as repeat
                int total = s.getTotalCount() + 1;
                s.setTotalCount(total);
                s.setLastSeenAt(now);
                s.setLastSeverity(severity);
                s.setOpenCount(s.getOpenCount() + 1);
                s.setPriorityScore(BigDecimal.valueOf(SpeakingPriority.skillScore(total, now, severity)));
                userErrorSkillRepository.save(s);
            }
        }
    }

    private void recordAssistantTurnMetrics(AiResponseDto parsed) {
        boolean noMajor = parsed.errors() == null || parsed.errors().stream().noneMatch(e -> {
            String s = e.severity() == null ? "" : e.severity().toUpperCase(Locale.ROOT);
            return s.contains("MAJOR") || s.contains("BLOCKING");
        });
        speakingMetrics.recordTurnAccuracy(noMajor);
        speakingMetrics.recordErrorsEmitted(parsed.errors());
    }

    private void saveLegacyGrammarError(Long userId, Long sessionId, Long messageId,
                                        String grammarPoint, String originalText,
                                        String correctionText, UserLearningProfile profile) {
        try {
            String cefrLevel = (profile != null && profile.getTargetLevel() != null)
                    ? profile.getTargetLevel().name() : null;
            grammarErrorRepository.save(UserGrammarError.builder()
                    .userId(userId)
                    .sessionId(sessionId)
                    .messageId(messageId)
                    .grammarPoint(grammarPoint)
                    .originalText(originalText)
                    .correctionText(correctionText)
                    .severity(detectSeverity(correctionText))
                    .cefrLevel(cefrLevel)
                    .repairStatus("OPEN")
                    .createdAt(LocalDateTime.now())
                    .build());
        } catch (Exception e) {
            log.warn("Failed to save grammar error: {}", e.getMessage());
        }
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

    private static BigDecimal toStoredConfidence(Double c) {
        if (c == null) return null;
        return BigDecimal.valueOf(c).setScale(3, RoundingMode.HALF_UP);
    }

    private String detectSeverity(String correction) {
        if (correction == null || correction.isBlank()) {
            return GrammarErrorSeverity.MINOR.name();
        }
        String lower = correction.toLowerCase();
        if (lower.contains("falsch") || lower.contains("incorrect") || lower.contains("never")) {
            return GrammarErrorSeverity.BLOCKING.name();
        }
        return GrammarErrorSeverity.MAJOR.name();
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
    private void updateUserLearningProgress(Long userId, AiResponseDto parsed) {
        try {
            String lastError = null;
            if ("OFF_TOPIC".equals(parsed.status())) {
                lastError = "OFF_TOPIC";
            } else if (parsed.errors() != null && !parsed.errors().isEmpty()) {
                lastError = parsed.errors().get(0).errorCode();
            } else if (parsed.correction() != null && !parsed.correction().isBlank()) {
                lastError = "GENERAL_GRAMMAR";
            }

            if (lastError != null) {
                final String finalError = lastError;
                UserLearningProgress progress = progressRepository.findByUserId(userId)
                        .orElseGet(() -> UserLearningProgress.builder()
                                .user(userRepository.getReferenceById(userId))
                                .build());
                progress.setLastErrorType(finalError);
                progressRepository.save(progress);
            }
        } catch (Exception e) {
            log.warn("Failed to update user learning progress: {}", e.getMessage());
        }
    }
}
