package com.deutschflow.speaking.service;

import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.AiResponseDto;
import com.deutschflow.speaking.dto.AiSpeakingChatResponse;
import com.deutschflow.speaking.metrics.SpeakingMetrics;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * SSE streaming lifecycle for AI speaking chat, extracted from {@code AiSpeakingServiceImpl}.
 *
 * <p>Owns the guard-acquire + off-servlet-thread dispatch + per-token emission + "done"/cancel/
 * error events + guard release for the streaming chat path. Behavior is preserved exactly from
 * the original facade methods (token events, "done" event, cancel event, error handling, guard
 * release, transaction boundaries).
 *
 * <p><strong>The turn-finalize callback breaks the cycle.</strong> Persisting a completed turn
 * ({@code finalizeSpeakingChatPersistence}) stays on the facade because it is shared with the
 * blocking {@code chat} path; this service receives it as a {@link SpeakingTurnFinalizer} rather
 * than holding a back-reference to {@code AiSpeakingServiceImpl}. The finalizer runs inside the
 * same {@code transactionTemplate.execute(...)} write transaction that wrapped it on the facade —
 * the transaction boundary is unchanged.
 *
 * <p>DB shape (unchanged): short read TX in prepare ({@link ChatPrepService}), LLM call outside
 * any transaction (so no JDBC connection is held during model latency), write TX in finalize.
 */
@Service
@Slf4j
public class SpeakingStreamService {

    /** Lower-variance JSON / tutor replies for structured V1/V2. */
    private static final double SPEAKING_CHAT_TEMPERATURE = 0.35;

    private final TransactionTemplate transactionTemplate;
    private final ObjectMapper objectMapper;
    private final SpeakingMetrics speakingMetrics;
    private final com.deutschflow.system.service.SystemConfigService systemConfigService;
    private final Executor speakingStreamExecutor;
    private final SessionTurnGuard sessionTurnGuard;
    private final ChatPrepService chatPrepService;
    private final ChatCompletionService chatCompletionService;

    public SpeakingStreamService(
            TransactionTemplate transactionTemplate,
            ObjectMapper objectMapper,
            SpeakingMetrics speakingMetrics,
            com.deutschflow.system.service.SystemConfigService systemConfigService,
            @Qualifier("speakingStreamExecutor") Executor speakingStreamExecutor,
            SessionTurnGuard sessionTurnGuard,
            ChatPrepService chatPrepService,
            ChatCompletionService chatCompletionService) {
        this.transactionTemplate = transactionTemplate;
        this.objectMapper = objectMapper;
        this.speakingMetrics = speakingMetrics;
        this.systemConfigService = systemConfigService;
        this.speakingStreamExecutor = speakingStreamExecutor;
        this.sessionTurnGuard = sessionTurnGuard;
        this.chatPrepService = chatPrepService;
        this.chatCompletionService = chatCompletionService;
    }

    /**
     * Acquires the per-session turn guard and dispatches the streaming work onto
     * {@code speakingStreamExecutor} so Tomcat threads are not held during LLM I/O.
     *
     * <p>On a synchronous failure (guard contention or dispatch error) the guard is released here;
     * otherwise the off-thread task releases it in its {@code finally}.
     *
     * @param finalizer the facade's {@code finalizeSpeakingChatPersistence}, invoked inside the
     *                  finalize write transaction once the stream completes normally.
     */
    public void startStream(Long userId, Long sessionId, String userMessage, SseEmitter emitter,
                            AtomicBoolean streamCancelled, SpeakingTurnFinalizer finalizer) {
        Instant start = Instant.now();
        boolean acquired = false;
        boolean failed = false;
        try {
            if (!sessionTurnGuard.tryAcquire(sessionId)) {
                throw new ConflictException("This interview turn is already being processed.");
            }
            acquired = true;
            speakingStreamExecutor.execute(() -> runChatStreamOffServletThread(
                    userId, sessionId, userMessage, emitter, streamCancelled, finalizer));
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
                                               SseEmitter emitter, AtomicBoolean streamCancelled,
                                               SpeakingTurnFinalizer finalizer) {
        try {
            AiSpeakingServiceImpl.SpeakingChatPrep prep = transactionTemplate.execute(
                    status -> chatPrepService.prepareSpeakingChatTurn(userId, sessionId, userMessage));
            if (prep == null) {
                emitter.completeWithError(new IllegalStateException("prepareSpeakingChatTurn returned null"));
                return;
            }

            Instant streamStart = Instant.now();
            boolean finished = streamChatCompletion(prep, userMessage, emitter, streamCancelled, finalizer);
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

    private boolean streamChatCompletion(AiSpeakingServiceImpl.SpeakingChatPrep prep,
                                         String userMessage,
                                         SseEmitter emitter,
                                         AtomicBoolean streamCancelled,
                                         SpeakingTurnFinalizer finalizer) {
        Double tempConfig = systemConfigService.getDouble("ai.temperature", SPEAKING_CHAT_TEMPERATURE);
        return chatCompletionService.chatClientFor(prep.sessionMode()).chatCompletionStream(prep.openAiMessages(), null, tempConfig, prep.maxTokens(),
                token -> {
                    try {
                        emitter.send(SseEmitter.event().name("token").data(token));
                    } catch (Exception e) {
                        log.warn("[SSE] Failed to send token: {}", e.getMessage());
                    }
                },
                ai -> handleStreamCompletion(prep, userMessage, emitter, ai, finalizer),
                streamCancelled);
    }

    private void handleStreamCompletion(AiSpeakingServiceImpl.SpeakingChatPrep prep,
                                        String userMessage,
                                        SseEmitter emitter,
                                        AiChatCompletionResult ai,
                                        SpeakingTurnFinalizer finalizer) {
        try {
            AiResponseDto parsed = chatCompletionService.parseAndPostProcess(ai, userMessage, prep);
            AiSpeakingChatResponse donePayload = Objects.requireNonNull(
                    transactionTemplate.execute(status ->
                            finalizer.finalizeTurn(prep, userMessage, ai, parsed, "SPEAKING_STREAM")));
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
}
