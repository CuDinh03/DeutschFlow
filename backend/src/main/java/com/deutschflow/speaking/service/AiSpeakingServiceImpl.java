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
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.deutschflow.common.quota.AiUsageLedgerService;
import com.deutschflow.common.quota.QuotaService;
import com.deutschflow.common.quota.RequestContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
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
@Transactional
@RequiredArgsConstructor
@Slf4j
public class AiSpeakingServiceImpl implements AiSpeakingService {

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
    private final ReviewSchedulerService reviewSchedulerService;
    private final SpeakingMetrics speakingMetrics;
    private final AdaptivePolicyService adaptivePolicyService;
    private final TurnEvaluatorService turnEvaluatorService;
    private final QuotaService quotaService;
    private final AiUsageLedgerService aiUsageLedgerService;

    @Override
    public AiSpeakingSessionDto createSession(Long userId, String topic, String cefrLevel) {
        UserLearningProfile p = profileRepository.findByUserId(userId).orElse(null);
        String resolved =
                (cefrLevel == null || cefrLevel.isBlank())
                        ? SpeakingCefrSupport.floorPracticeBand(p)
                        : SpeakingCefrSupport.clampToProfileRange(cefrLevel, p);
        AiSpeakingSession session = AiSpeakingSession.builder()
                .userId(userId)
                .topic(topic)
                .cefrLevel(resolved)
                .status(SessionStatus.ACTIVE)
                .messageCount(0)
                .build();
        session = sessionRepository.save(session);
        return toSessionDto(session);
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

    private AiSpeakingChatResponse chatInner(Long userId, Long sessionId, String userMessage) {
        // 1. Validate session ownership and status
        AiSpeakingSession session = loadSessionForUser(userId, sessionId);
        if (session.getStatus() == SessionStatus.ENDED) {
            throw new ConflictException("This session has already ended.");
        }

        // 2. Load user profile for personalization
        UserLearningProfile profile = profileRepository.findByUserId(userId).orElse(null);
        List<String> knownInterests = extractInterests(profile);

        // 3. Load top weak grammar points to inject into prompt
        List<WeakPoint> weakPoints = grammarErrorRepository.findTopWeakPoints(
                userId, PageRequest.of(0, 5));

        // 4. Build conversation history (last 10 messages, chronological order)
        List<AiSpeakingMessage> recentMessages =
                messageRepository.findTop10BySessionIdOrderByCreatedAtDesc(sessionId);
        Collections.reverse(recentMessages);
        if (recentMessages.size() > 6) {
            recentMessages = new ArrayList<>(recentMessages.subList(recentMessages.size() - 6, recentMessages.size()));
        }

        // 5. Build system prompt with profile + topic + level (session level overrides profile)
        UserLearningProfile effectiveProfile = profile != null ? profile : defaultProfile();
        SpeakingPolicy policy = adaptivePolicyService.computePolicy(userId, session, effectiveProfile, knownInterests);
        String systemPrompt = policy.enabled()
                ? promptBuilder.buildSystemPrompt(
                effectiveProfile, knownInterests, session.getTopic(), weakPoints, session.getCefrLevel(), policy)
                : promptBuilder.buildSystemPrompt(
                effectiveProfile, knownInterests, session.getTopic(), weakPoints, session.getCefrLevel());

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

        // 6. Quota pre-check and AI call (AiServiceException propagates as-is → mapped to 503 by controller)
        var snapshot = quotaService.assertAllowed(userId, Instant.now(), 1L);
        int maxTokens = (int) Math.max(1L, Math.min(600L, snapshot.remainingThisMonth()));
        AiChatCompletionResult ai = openAiChatClient.chatCompletion(openAiMessages, null, 0.4, maxTokens);
        AiParseOutcome parseOutcome = responseParser.parseWithOutcome(ai.content());
        speakingMetrics.recordAiParseOutcome(parseOutcome.status());
        AiResponseDto parsedRaw = parseOutcome.dto();
        AiResponseDto parsed = new AiResponseDto(
                parsedRaw.aiSpeechDe(),
                parsedRaw.correction(),
                parsedRaw.explanationVi(),
                parsedRaw.grammarPoint(),
                parsedRaw.newWord(),
                parsedRaw.userInterestDetected(),
                AiErrorSanitizer.sanitize(userMessage, parsedRaw.errors())
        );

        // 7. Persist USER message
        AiSpeakingMessage userMsg = AiSpeakingMessage.builder()
                .sessionId(sessionId)
                .role(MessageRole.USER)
                .userText(userMessage)
                .build();
        messageRepository.save(userMsg);

        // 8. Persist ASSISTANT message
        AiSpeakingMessage assistantMsg = AiSpeakingMessage.builder()
                .sessionId(sessionId)
                .role(MessageRole.ASSISTANT)
                .aiSpeechDe(parsed.aiSpeechDe())
                .correction(parsed.correction())
                .explanationVi(parsed.explanationVi())
                .grammarPoint(parsed.grammarPoint())
                .newWord(parsed.newWord())
                .userInterestDetected(parsed.userInterestDetected())
                .build();
        assistantMsg = messageRepository.save(assistantMsg);

        // 9. Save grammar error records (structured errors[] or legacy correction)
        persistGrammarFeedback(userId, sessionId, assistantMsg.getId(), userMessage, parsed, effectiveProfile);
        recordAssistantTurnMetrics(parsed);

        // 9.1 Persist token usage ledger (best-effort; do not fail user flow)
        try {
            if (ai.usage() != null) {
                aiUsageLedgerService.record(
                        userId,
                        ai.provider(),
                        ai.model(),
                        ai.usage().promptTokens(),
                        ai.usage().completionTokens(),
                        ai.usage().totalTokens(),
                        "SPEAKING_CHAT",
                        RequestContext.requestIdOrNull(),
                        sessionId
                );
            }
        } catch (Exception e) {
            log.warn("Skip token usage ledger due to error: {}", e.getMessage());
        }

        // 10. Merge newly detected interest into UserLearningProfile
        if (parsed.userInterestDetected() != null && !parsed.userInterestDetected().isBlank()
                && profile != null) {
            mergeInterest(profile, parsed.userInterestDetected());
        }

        turnEvaluatorService.recordTurn(userId, sessionId, assistantMsg.getId(), parsed, policy);

        // 11. Update session metadata
        session.setLastActivityAt(LocalDateTime.now());
        session.setMessageCount(session.getMessageCount() + 2);
        sessionRepository.save(session);

        AdaptiveMetaDto adaptive = AdaptiveMetaDto.fromPolicyAndResponse(policy, parsed);
        if (adaptive != null && adaptive.forceRepairBeforeContinue()) {
            speakingMetrics.recordForceRepair();
        }

        // 12. Return structured response
        return new AiSpeakingChatResponse(
                assistantMsg.getId(),
                sessionId,
                parsed.aiSpeechDe(),
                parsed.correction(),
                parsed.explanationVi(),
                parsed.grammarPoint(),
                new AiSpeakingChatResponse.LearningStatus(
                        parsed.newWord(),
                        parsed.userInterestDetected()
                ),
                toErrorItemDtos(parsed.errors()),
                adaptive
        );
    }

    @Override
    public void chatStream(Long userId, Long sessionId, String userMessage, SseEmitter emitter,
                           AtomicBoolean streamCancelled) {
        try {
            AiSpeakingSession session = loadSessionForUser(userId, sessionId);
            if (session.getStatus() == SessionStatus.ENDED) {
                emitter.send(SseEmitter.event().name("error").data("Session has already ended."));
                emitter.complete();
                return;
            }

            UserLearningProfile profile = profileRepository.findByUserId(userId).orElse(null);
            List<String> knownInterests = extractInterests(profile);
            List<WeakPoint> weakPoints = grammarErrorRepository.findTopWeakPoints(
                    userId, PageRequest.of(0, 5));

            List<AiSpeakingMessage> recentMessages =
                    messageRepository.findTop10BySessionIdOrderByCreatedAtDesc(sessionId);
            Collections.reverse(recentMessages);
            if (recentMessages.size() > 6) {
                recentMessages = new ArrayList<>(recentMessages.subList(recentMessages.size() - 6, recentMessages.size()));
            }

            UserLearningProfile effectiveProfile = profile != null ? profile : defaultProfile();
            SpeakingPolicy policy = adaptivePolicyService.computePolicy(userId, session, effectiveProfile, knownInterests);
            String systemPrompt = policy.enabled()
                    ? promptBuilder.buildSystemPrompt(
                    effectiveProfile, knownInterests, session.getTopic(), weakPoints, session.getCefrLevel(), policy)
                    : promptBuilder.buildSystemPrompt(
                    effectiveProfile, knownInterests, session.getTopic(), weakPoints, session.getCefrLevel());

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
            int maxTokens = (int) Math.max(1L, Math.min(600L, snapshot.remainingThisMonth()));
            Instant streamStart = Instant.now();

            boolean finished = openAiChatClient.chatCompletionStream(openAiMessages, null, 0.4, maxTokens,
                    token -> {
                        try {
                            emitter.send(SseEmitter.event().name("token").data(token));
                        } catch (Exception e) {
                            log.warn("[SSE] Failed to send token: {}", e.getMessage());
                        }
                    },
                    (ai) -> {
                        // Streaming done — parse full JSON, persist, then send done event
                        try {
                            AiParseOutcome parseOutcomeStream = responseParser.parseWithOutcome(ai.content());
                            speakingMetrics.recordAiParseOutcome(parseOutcomeStream.status());
                            AiResponseDto parsedRaw = parseOutcomeStream.dto();
                            AiResponseDto parsed = new AiResponseDto(
                                    parsedRaw.aiSpeechDe(),
                                    parsedRaw.correction(),
                                    parsedRaw.explanationVi(),
                                    parsedRaw.grammarPoint(),
                                    parsedRaw.newWord(),
                                    parsedRaw.userInterestDetected(),
                                    AiErrorSanitizer.sanitize(userMessage, parsedRaw.errors())
                            );

                            AiSpeakingMessage userMsg = AiSpeakingMessage.builder()
                                    .sessionId(sessionId).role(MessageRole.USER)
                                    .userText(userMessage).build();
                            messageRepository.save(userMsg);

                            AiSpeakingMessage assistantMsg = AiSpeakingMessage.builder()
                                    .sessionId(sessionId).role(MessageRole.ASSISTANT)
                                    .aiSpeechDe(parsed.aiSpeechDe())
                                    .correction(parsed.correction())
                                    .explanationVi(parsed.explanationVi())
                                    .grammarPoint(parsed.grammarPoint())
                                    .newWord(parsed.newWord())
                                    .userInterestDetected(parsed.userInterestDetected())
                                    .build();
                            assistantMsg = messageRepository.save(assistantMsg);

                            persistGrammarFeedback(userId, sessionId, assistantMsg.getId(),
                                    userMessage, parsed, effectiveProfile);
                            recordAssistantTurnMetrics(parsed);
                            speakingMetrics.recordChatRequest("stream", "ok");

                            try {
                                if (ai.usage() != null) {
                                    aiUsageLedgerService.record(
                                            userId,
                                            ai.provider(),
                                            ai.model(),
                                            ai.usage().promptTokens(),
                                            ai.usage().completionTokens(),
                                            ai.usage().totalTokens(),
                                            "SPEAKING_STREAM",
                                            RequestContext.requestIdOrNull(),
                                            sessionId
                                    );
                                }
                            } catch (Exception ledgerEx) {
                                log.warn("Skip token usage ledger due to error: {}", ledgerEx.getMessage());
                            }

                            turnEvaluatorService.recordTurn(userId, sessionId, assistantMsg.getId(), parsed, policy);

                            if (parsed.userInterestDetected() != null
                                    && !parsed.userInterestDetected().isBlank()
                                    && profile != null) {
                                mergeInterest(profile, parsed.userInterestDetected());
                            }

                            session.setLastActivityAt(LocalDateTime.now());
                            session.setMessageCount(session.getMessageCount() + 2);
                            sessionRepository.save(session);

                            AdaptiveMetaDto adaptive = AdaptiveMetaDto.fromPolicyAndResponse(policy, parsed);
                            if (adaptive != null && adaptive.forceRepairBeforeContinue()) {
                                speakingMetrics.recordForceRepair();
                            }

                            AiSpeakingChatResponse donePayload = new AiSpeakingChatResponse(
                                    assistantMsg.getId(), sessionId,
                                    parsed.aiSpeechDe(), parsed.correction(),
                                    parsed.explanationVi(), parsed.grammarPoint(),
                                    new AiSpeakingChatResponse.LearningStatus(
                                            parsed.newWord(), parsed.userInterestDetected()),
                                    toErrorItemDtos(parsed.errors()),
                                    adaptive);
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
                log.debug("[SSE] Groq stream aborted (timeout/cancel); skipping persist");
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
        AiSpeakingSession session = loadSessionForUser(userId, sessionId);
        if (session.getStatus() == SessionStatus.ENDED) {
            throw new ConflictException("This session has already ended.");
        }
        session.setStatus(SessionStatus.ENDED);
        session.setEndedAt(LocalDateTime.now());
        session = sessionRepository.save(session);
        return toSessionDto(session);
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
            int total = s.getTotalCount() + 1;
            s.setTotalCount(total);
            s.setLastSeenAt(now);
            s.setLastSeverity(severity);
            s.setOpenCount(s.getOpenCount() + 1);
            s.setPriorityScore(BigDecimal.valueOf(SpeakingPriority.skillScore(total, now, severity)));
            userErrorSkillRepository.save(s);
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
        return new AiSpeakingSessionDto(
                s.getId(), s.getTopic(), s.getCefrLevel(), s.getStatus().name(),
                s.getStartedAt(), s.getLastActivityAt(), s.getEndedAt(), s.getMessageCount());
    }

    private AiSpeakingMessageDto toMessageDto(AiSpeakingMessage m, List<UserGrammarError> grammarRows) {
        List<ErrorItemDto> errors = grammarRows.stream()
                .map(this::toErrorItemDto)
                .toList();
        return new AiSpeakingMessageDto(
                m.getId(), m.getRole().name(), m.getUserText(),
                m.getAiSpeechDe(), m.getCorrection(), m.getExplanationVi(),
                m.getGrammarPoint(), m.getNewWord(), m.getUserInterestDetected(), m.getCreatedAt(),
                errors);
    }
}
