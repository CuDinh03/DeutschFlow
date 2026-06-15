package com.deutschflow.speaking.service;

import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.AiResponseDto;
import com.deutschflow.speaking.dto.AiSpeakingChatResponse;
import com.deutschflow.speaking.metrics.SpeakingMetrics;
import com.deutschflow.speaking.tts.SpeakingTtsPipeline;
import com.deutschflow.speaking.tts.XttsPersonaVoiceResolver;
import com.deutschflow.speaking.tts.XttsStreamClient;
import com.deutschflow.speaking.tts.XttsVoice;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
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
    private final XttsStreamClient xttsStreamClient;
    private final XttsPersonaVoiceResolver voiceResolver;
    private final Executor xttsTtsExecutor;

    public SpeakingStreamService(
            TransactionTemplate transactionTemplate,
            ObjectMapper objectMapper,
            SpeakingMetrics speakingMetrics,
            com.deutschflow.system.service.SystemConfigService systemConfigService,
            @Qualifier("speakingStreamExecutor") Executor speakingStreamExecutor,
            SessionTurnGuard sessionTurnGuard,
            ChatPrepService chatPrepService,
            ChatCompletionService chatCompletionService,
            XttsStreamClient xttsStreamClient,
            XttsPersonaVoiceResolver voiceResolver,
            @Qualifier("xttsTtsExecutor") Executor xttsTtsExecutor) {
        this.transactionTemplate = transactionTemplate;
        this.objectMapper = objectMapper;
        this.speakingMetrics = speakingMetrics;
        this.systemConfigService = systemConfigService;
        this.speakingStreamExecutor = speakingStreamExecutor;
        this.sessionTurnGuard = sessionTurnGuard;
        this.chatPrepService = chatPrepService;
        this.chatCompletionService = chatCompletionService;
        this.xttsStreamClient = xttsStreamClient;
        this.voiceResolver = voiceResolver;
        this.xttsTtsExecutor = xttsTtsExecutor;
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
                            AtomicBoolean streamCancelled, boolean streamAudio, SpeakingTurnFinalizer finalizer) {
        Instant start = Instant.now();
        boolean acquired = false;
        boolean failed = false;
        try {
            if (!sessionTurnGuard.tryAcquire(sessionId)) {
                throw new ConflictException("This interview turn is already being processed.");
            }
            acquired = true;
            speakingStreamExecutor.execute(() -> runChatStreamOffServletThread(
                    userId, sessionId, userMessage, emitter, streamCancelled, streamAudio, finalizer));
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
                                               boolean streamAudio, SpeakingTurnFinalizer finalizer) {
        try {
            AiSpeakingServiceImpl.SpeakingChatPrep prep = transactionTemplate.execute(
                    status -> chatPrepService.prepareSpeakingChatTurn(userId, sessionId, userMessage));
            if (prep == null) {
                emitter.completeWithError(new IllegalStateException("prepareSpeakingChatTurn returned null"));
                return;
            }

            Instant streamStart = Instant.now();
            boolean finished = streamChatCompletion(prep, userMessage, emitter, streamCancelled, streamAudio, finalizer);
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
                                         boolean streamAudio,
                                         SpeakingTurnFinalizer finalizer) {
        // All emitter.send for this turn serialize on this lock (LLM token thread + TTS worker thread).
        final Object emitterLock = new Object();
        final SpeakingTtsPipeline ttsPipeline =
                maybeBuildTtsPipeline(prep, emitter, emitterLock, streamCancelled, streamAudio);

        Double tempConfig = systemConfigService.getDouble("ai.temperature", SPEAKING_CHAT_TEMPERATURE);
        return chatCompletionService.chatClientFor(prep.sessionMode()).chatCompletionStream(
                prep.openAiMessages(), null, tempConfig, prep.maxTokens(),
                token -> {
                    sendQuietly(emitter, emitterLock, "token", token);
                    if (ttsPipeline != null) {
                        ttsPipeline.onToken(token);
                    }
                },
                ai -> handleStreamCompletion(prep, userMessage, emitter, emitterLock, ai, finalizer, ttsPipeline),
                streamCancelled);
    }

    private void handleStreamCompletion(AiSpeakingServiceImpl.SpeakingChatPrep prep,
                                        String userMessage,
                                        SseEmitter emitter,
                                        Object emitterLock,
                                        AiChatCompletionResult ai,
                                        SpeakingTurnFinalizer finalizer,
                                        SpeakingTtsPipeline ttsPipeline) {
        try {
            AiResponseDto parsed = chatCompletionService.parseAndPostProcess(ai, userMessage, prep);
            AiSpeakingChatResponse donePayload = Objects.requireNonNull(
                    transactionTemplate.execute(status ->
                            finalizer.finalizeTurn(prep, userMessage, ai, parsed, "SPEAKING_STREAM")));
            speakingMetrics.recordChatRequest("stream", "ok");
            // "done" carries the structured payload — send it the moment the LLM finishes (text is ready).
            sendQuietly(emitter, emitterLock, "done", objectMapper.writeValueAsString(donePayload));
            if (ttsPipeline != null) {
                // Audio trails the text: flush the final sentence, then close once all audio is delivered.
                ttsPipeline.finish();
                ttsPipeline.drain().whenComplete((v, ex) -> completeQuietly(emitter));
            } else {
                emitter.complete();
            }
        } catch (Exception ex) {
            log.error("[SSE] Error in onComplete handler", ex);
            speakingMetrics.recordChatRequest("stream", "error");
            emitter.completeWithError(ex);
        }
    }

    /**
     * Build the per-turn streaming-TTS pipeline, or {@code null} when audio was not requested, XTTS is
     * not configured, or the persona has no streaming voice (e.g. Vietnamese tutors → on-device).
     */
    private SpeakingTtsPipeline maybeBuildTtsPipeline(AiSpeakingServiceImpl.SpeakingChatPrep prep,
                                                      SseEmitter emitter,
                                                      Object emitterLock,
                                                      AtomicBoolean streamCancelled,
                                                      boolean streamAudio) {
        if (!streamAudio || !xttsStreamClient.isConfigured()) {
            return null;
        }
        Optional<XttsVoice> voice = voiceResolver.resolve(prep.persona());
        if (voice.isEmpty()) {
            return null;
        }
        String voiceId = voice.get().voiceId();
        return new SpeakingTtsPipeline(xttsStreamClient, voice.get(), xttsTtsExecutor,
                (index, text, pcm) -> {
                    if (!streamCancelled.get()) {
                        sendAudioEvent(emitter, emitterLock, index, text, voiceId, pcm);
                    }
                });
    }

    /** Send one SSE event under the per-stream lock; failures are logged, never thrown. */
    private void sendQuietly(SseEmitter emitter, Object emitterLock, String event, String data) {
        try {
            synchronized (emitterLock) {
                emitter.send(SseEmitter.event().name(event).data(data));
            }
        } catch (Exception e) {
            log.warn("[SSE] Failed to send '{}' event: {}", event, e.getMessage());
        }
    }

    private void sendAudioEvent(SseEmitter emitter, Object emitterLock, int index, String text,
                                String voiceId, byte[] pcm) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("index", index);
            payload.put("text", text);
            payload.put("voiceId", voiceId);
            payload.put("encoding", "pcm_s16le");
            payload.put("sampleRate", 24000);
            payload.put("channels", 1);
            payload.put("pcmBase64", Base64.getEncoder().encodeToString(pcm));
            sendQuietly(emitter, emitterLock, "audio", objectMapper.writeValueAsString(payload));
        } catch (Exception e) {
            log.warn("[SSE] Failed to build audio event #{}: {}", index, e.getMessage());
        }
    }

    private void completeQuietly(SseEmitter emitter) {
        try {
            emitter.complete();
        } catch (Exception e) {
            log.trace("[SSE] Emitter already completed: {}", e.getMessage());
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
