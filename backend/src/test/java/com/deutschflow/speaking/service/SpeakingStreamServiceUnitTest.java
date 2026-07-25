package com.deutschflow.speaking.service;

import com.deutschflow.common.exception.ConflictException;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.AiParseOutcome;
import com.deutschflow.speaking.ai.AiParseStatus;
import com.deutschflow.speaking.ai.AiResponseDto;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.contract.SpeakingResponseSchema;
import com.deutschflow.speaking.contract.SpeakingSessionMode;
import com.deutschflow.speaking.dto.AiSpeakingChatResponse;
import com.deutschflow.speaking.metrics.SpeakingMetrics;
import com.deutschflow.speaking.persona.SpeakingPersona;
import com.deutschflow.speaking.tts.XttsPersonaVoiceResolver;
import com.deutschflow.speaking.tts.XttsStreamClient;
import com.deutschflow.speaking.tts.XttsVoice;
import com.deutschflow.system.service.SystemConfigService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Real-behavior unit tests for {@link SpeakingStreamService} — the SSE streaming lifecycle
 * extracted from {@code AiSpeakingServiceImpl}. All collaborators are mocked. The off-servlet
 * executor and both transaction templates are made synchronous so the whole flow runs inline,
 * and the streaming client is driven to invoke (or skip) the completion callback.
 *
 * <p>Covers the four streaming outcomes: happy path (finalize + "done" + complete + guard release),
 * cancellation (no finalize, cancel "error" event + complete + release), error (structured "error"
 * event with a machine-readable code + CLEAN complete + release in finally — audit speaking 24/07
 * R-B2: completeWithError chỉ làm đứt kết nối nên client không bao giờ đọc được lý do), and a null
 * prep (same error-event contract, no finalize).
 */
@ExtendWith(MockitoExtension.class)
class SpeakingStreamServiceUnitTest {

    @Mock TransactionTemplate transactionTemplate;
    @Mock ObjectMapper objectMapper;
    @Mock SpeakingMetrics speakingMetrics;
    @Mock SystemConfigService systemConfigService;
    @Mock Executor speakingStreamExecutor;
    @Mock SessionTurnGuard sessionTurnGuard;
    @Mock ChatPrepService chatPrepService;
    @Mock ChatCompletionService chatCompletionService;
    @Mock XttsStreamClient xttsStreamClient;
    @Mock XttsPersonaVoiceResolver voiceResolver;

    /** Inline executor → TTS synthesis runs synchronously for deterministic assertions. */
    private final Executor xttsTtsExecutor = Runnable::run;

    // Stream client returned by chatCompletionService.chatClientFor(mode).
    @Mock OpenAiChatClient streamClient;
    // The facade callback (finalizeSpeakingChatPersistence) handed into startStream.
    @Mock SpeakingTurnFinalizer finalizer;
    // The SSE emitter the controller layer would have created.
    @Mock SseEmitter emitter;

    SpeakingStreamService service;

    private static final long SESSION_ID = 2L;
    private static final long USER_ID = 1L;
    private static final String USER_MESSAGE = "Ich gestern ging ins Kino.";

    @BeforeEach
    void setUp() {
        service = new SpeakingStreamService(
                transactionTemplate, objectMapper, speakingMetrics, systemConfigService,
                speakingStreamExecutor, sessionTurnGuard, chatPrepService, chatCompletionService,
                xttsStreamClient, voiceResolver, xttsTtsExecutor);
    }

    // ---- fixtures ----

    private static AiSpeakingServiceImpl.SpeakingChatPrep prep() {
        return new AiSpeakingServiceImpl.SpeakingChatPrep(
                USER_ID, SESSION_ID, null, "system", "B1", "topic",
                List.of(), 600, 0, SpeakingResponseSchema.V1,
                SpeakingSessionMode.COMMUNICATION, null, null, Instant.now(), SpeakingPersona.DEFAULT);
    }

    private static AiChatCompletionResult aiResult() {
        return new AiChatCompletionResult("raw-json", null, "GROQ", "model");
    }

    private static AiResponseDto parsedDto() {
        // The clean German reply (what TTS must speak) — two sentences.
        return new AiResponseDto(
                "Hallo. Wie geht's?", null, null, null, null, null,
                List.of(), "ON_TOPIC", null, null, null, null, null);
    }

    private static AiSpeakingChatResponse doneResponse() {
        return new AiSpeakingChatResponse(
                99L, SESSION_ID, "Sehr gut.", null, null, null,
                new AiSpeakingChatResponse.LearningStatus(null, null),
                List.of(), null, "ON_TOPIC", null, null, List.of(),
                "V1", null, false, null, null);
    }

    /** Run the Runnable handed to the executor synchronously (on the calling thread). */
    private void executorRunsInline() {
        doAnswer(inv -> {
            inv.getArgument(0, Runnable.class).run();
            return null;
        }).when(speakingStreamExecutor).execute(any());
    }

    /** Make transactionTemplate.execute(...) invoke its callback immediately with a null status. */
    private void transactionRunsInline() {
        when(transactionTemplate.execute(any())).thenAnswer(inv ->
                inv.getArgument(0, TransactionCallback.class).doInTransaction(null));
    }

    /**
     * Stub the streaming client. {@code finishedNormally=true} → invoke the completion callback
     * (arg index 5) with a test result and return {@code true}; {@code false} → return {@code false}
     * without invoking the callback (simulates a timeout/cancel abort).
     */
    @SuppressWarnings("unchecked")
    private void streamClientCompletes(boolean finishedNormally) {
        when(chatCompletionService.chatClientFor(any())).thenReturn(streamClient);
        when(streamClient.chatCompletionStream(any(), eq(null), anyDouble(), anyInt(),
                any(), any(), any())).thenAnswer(inv -> {
            if (finishedNormally) {
                java.util.function.Consumer<AiChatCompletionResult> onComplete = inv.getArgument(5);
                onComplete.accept(aiResult());
                return true;
            }
            return false;
        });
    }

    // ---------------------------------------------------------------------
    // 1. Happy path
    // ---------------------------------------------------------------------

    @Test
    @DisplayName("startStream happy path: guard acquired, prep loaded, finalizer invoked with SPEAKING_STREAM, done event sent, emitter completed, guard released")
    void startStream_happyPath_finalizesAndCompletes() throws Exception {
        // Arrange
        when(sessionTurnGuard.tryAcquire(SESSION_ID)).thenReturn(true);
        executorRunsInline();
        transactionRunsInline();
        when(chatPrepService.prepareSpeakingChatTurn(USER_ID, SESSION_ID, USER_MESSAGE)).thenReturn(prep());
        when(systemConfigService.getDouble(eq("ai.temperature"), any())).thenReturn(0.35);
        streamClientCompletes(true);
        when(chatCompletionService.parseAndPostProcess(any(), eq(USER_MESSAGE), any())).thenReturn(new AiParseOutcome(parsedDto(), AiParseStatus.STRUCTURED));
        when(finalizer.finalizeTurn(any(), eq(USER_MESSAGE), any(), any(), anyBoolean(), eq("SPEAKING_STREAM")))
                .thenReturn(doneResponse());
        when(objectMapper.writeValueAsString(any())).thenReturn("{\"messageId\":99}");

        // Act
        service.startStream(USER_ID, SESSION_ID, USER_MESSAGE, emitter, new AtomicBoolean(false), false, finalizer);

        // Assert — guard taken, prep loaded, finalize ran with the stream purpose
        verify(sessionTurnGuard).tryAcquire(SESSION_ID);
        verify(chatPrepService).prepareSpeakingChatTurn(USER_ID, SESSION_ID, USER_MESSAGE);
        verify(finalizer).finalizeTurn(any(), eq(USER_MESSAGE), any(), any(), anyBoolean(), eq("SPEAKING_STREAM"));
        // "done" payload serialized + sent, emitter completed normally (not errored)
        verify(objectMapper).writeValueAsString(doneResponse());
        verify(emitter).send(any(SseEmitter.SseEventBuilder.class));
        verify(emitter).complete();
        verify(emitter, never()).completeWithError(any());
        // guard released in finally
        verify(sessionTurnGuard).release(SESSION_ID);
        // ok metric for the stream
        verify(speakingMetrics).recordChatRequest("stream", "ok");
    }

    // ---------------------------------------------------------------------
    // 2. Cancelled
    // ---------------------------------------------------------------------

    @Test
    @DisplayName("startStream cancelled: streaming returns false, finalizer NOT called, cancel error event + complete sent, guard released")
    void startStream_cancelled_skipsFinalizeAndSendsCancel() throws Exception {
        // Arrange
        when(sessionTurnGuard.tryAcquire(SESSION_ID)).thenReturn(true);
        executorRunsInline();
        transactionRunsInline();
        when(chatPrepService.prepareSpeakingChatTurn(USER_ID, SESSION_ID, USER_MESSAGE)).thenReturn(prep());
        when(systemConfigService.getDouble(eq("ai.temperature"), any())).thenReturn(0.35);
        streamClientCompletes(false); // aborts → onComplete never invoked

        // Act
        service.startStream(USER_ID, SESSION_ID, USER_MESSAGE, emitter, new AtomicBoolean(true), false, finalizer);

        // Assert — no finalize, cancel event + complete, guard released
        verify(finalizer, never()).finalizeTurn(any(), any(), any(), any(), anyBoolean(), any());
        verify(emitter).send(any(SseEmitter.SseEventBuilder.class)); // the "Stream cancelled." error event
        verify(emitter).complete();
        verify(emitter, never()).completeWithError(any());
        verify(sessionTurnGuard).release(SESSION_ID);
        verify(speakingMetrics).recordChatRequest("stream", "cancelled");
    }

    // ---------------------------------------------------------------------
    // 3. Error during the flow
    // ---------------------------------------------------------------------

    @Test
    @DisplayName("startStream error: gửi event `error` có code máy-đọc-được, đóng SẠCH emitter và vẫn nhả guard")
    void startStream_error_completesWithErrorAndReleasesGuard() throws Exception {
        // Arrange
        when(sessionTurnGuard.tryAcquire(SESSION_ID)).thenReturn(true);
        executorRunsInline();
        transactionRunsInline();
        stubErrorEventSerialization();
        RuntimeException boom = new IllegalStateException("prep blew up");
        when(chatPrepService.prepareSpeakingChatTurn(USER_ID, SESSION_ID, USER_MESSAGE)).thenThrow(boom);

        // Act
        service.startStream(USER_ID, SESSION_ID, USER_MESSAGE, emitter, new AtomicBoolean(false), false, finalizer);

        // Assert — hợp đồng audit R-B2: event lỗi + complete() (KHÔNG completeWithError, vì SSE đã
        // commit 200 nên completeWithError chỉ làm client thấy "kết nối đứt" không lý do)
        verify(emitter).send(any(SseEmitter.SseEventBuilder.class));
        assertThat(capturedErrorPayload()).contains("\"code\":\"INTERNAL\"");
        verify(emitter).complete();
        verify(emitter, never()).completeWithError(any());
        verify(finalizer, never()).finalizeTurn(any(), any(), any(), any(), anyBoolean(), any());
        verify(sessionTurnGuard).release(SESSION_ID);
        verify(speakingMetrics).recordChatRequest("stream", "error");
    }

    // ---------------------------------------------------------------------
    // 4. prepareSpeakingChatTurn returns null
    // ---------------------------------------------------------------------

    @Test
    @DisplayName("startStream null prep: gửi event `error` rồi đóng sạch, không finalize khi prepareSpeakingChatTurn trả null")
    void startStream_nullPrep_completesWithErrorNoFinalize() throws Exception {
        // Arrange
        when(sessionTurnGuard.tryAcquire(SESSION_ID)).thenReturn(true);
        executorRunsInline();
        transactionRunsInline();
        stubErrorEventSerialization();
        when(chatPrepService.prepareSpeakingChatTurn(USER_ID, SESSION_ID, USER_MESSAGE)).thenReturn(null);

        // Act
        service.startStream(USER_ID, SESSION_ID, USER_MESSAGE, emitter, new AtomicBoolean(false), false, finalizer);

        // Assert — dừng trước khi stream, event lỗi + đóng sạch, guard vẫn nhả
        verify(emitter).send(any(SseEmitter.SseEventBuilder.class));
        assertThat(capturedErrorPayload()).contains("\"code\":\"INTERNAL\"");
        verify(emitter).complete();
        verify(emitter, never()).completeWithError(any());
        verify(finalizer, never()).finalizeTurn(any(), any(), any(), any(), anyBoolean(), any());
        verify(chatCompletionService, never()).chatClientFor(any());
        verify(sessionTurnGuard).release(SESSION_ID);
    }

    /**
     * {@code objectMapper} là mock nên phải cho createObjectNode trả node THẬT để
     * sendErrorEventAndComplete dựng được payload; writeValueAsString trả JSON của chính node
     * đó (toString của ObjectNode là JSON hợp lệ) để test soi được field {@code code}.
     */
    private void stubErrorEventSerialization() throws Exception {
        when(objectMapper.createObjectNode()).thenAnswer(inv -> new ObjectMapper().createObjectNode());
        when(objectMapper.writeValueAsString(any())).thenAnswer(inv -> inv.getArgument(0).toString());
    }

    /** JSON của payload event `error` vừa được serialize (đi qua writeValueAsString đã stub). */
    private String capturedErrorPayload() throws Exception {
        var captor = org.mockito.ArgumentCaptor.forClass(Object.class);
        verify(objectMapper).writeValueAsString(captor.capture());
        return String.valueOf(captor.getValue());
    }

    // ---------------------------------------------------------------------
    // Guard contention — synchronous failure path of startStream itself
    // ---------------------------------------------------------------------

    @Test
    @DisplayName("startStream throws and does NOT dispatch when the turn guard is already held")
    void startStream_guardHeld_throwsAndDoesNotDispatch() {
        // Arrange
        when(sessionTurnGuard.tryAcquire(SESSION_ID)).thenReturn(false);

        // Act + Assert
        assertThatThrownBy(() ->
                service.startStream(USER_ID, SESSION_ID, USER_MESSAGE, emitter, new AtomicBoolean(false), false, finalizer))
                .isInstanceOf(ConflictException.class);

        // never dispatched, never released (it was never acquired)
        verify(speakingStreamExecutor, never()).execute(any());
        verify(sessionTurnGuard, never()).release(SESSION_ID);
        verify(finalizer, never()).finalizeTurn(any(), any(), any(), any(), anyBoolean(), any());
        verify(speakingMetrics).recordChatRequest("stream_start", "error");
    }

    // ---------------------------------------------------------------------
    // 6. Streaming TTS wiring (streamAudio)
    // ---------------------------------------------------------------------

    private static final XttsVoice TTS_VOICE = new XttsVoice("de-lukas_man", 1.0, 0.68, 5.0, "de");

    /** Drive the stream client to emit the given tokens, then invoke onComplete (returns true). */
    @SuppressWarnings("unchecked")
    private void streamClientStreamsThenCompletes(String... tokens) {
        when(chatCompletionService.chatClientFor(any())).thenReturn(streamClient);
        when(streamClient.chatCompletionStream(any(), eq(null), anyDouble(), anyInt(), any(), any(), any()))
                .thenAnswer(inv -> {
                    java.util.function.Consumer<String> onToken = inv.getArgument(4);
                    for (String t : tokens) {
                        onToken.accept(t);
                    }
                    ((java.util.function.Consumer<AiChatCompletionResult>) inv.getArgument(5)).accept(aiResult());
                    return true;
                });
    }

    /** Shared happy-path stubs for the streaming flow up to (and including) "done". */
    private void arrangeStreamFlow() {
        when(sessionTurnGuard.tryAcquire(SESSION_ID)).thenReturn(true);
        executorRunsInline();
        transactionRunsInline();
        when(chatPrepService.prepareSpeakingChatTurn(USER_ID, SESSION_ID, USER_MESSAGE)).thenReturn(prep());
        when(systemConfigService.getDouble(eq("ai.temperature"), any())).thenReturn(0.35);
        when(chatCompletionService.parseAndPostProcess(any(), eq(USER_MESSAGE), any())).thenReturn(new AiParseOutcome(parsedDto(), AiParseStatus.STRUCTURED));
        when(finalizer.finalizeTurn(any(), eq(USER_MESSAGE), any(), any(), anyBoolean(), eq("SPEAKING_STREAM"))).thenReturn(doneResponse());
        try {
            when(objectMapper.writeValueAsString(any())).thenReturn("{}");
        } catch (Exception ignored) {
            // writeValueAsString declares a checked exception; never thrown by the stub.
        }
    }

    @Test
    @DisplayName("streamAudio: speaks the PARSED German reply sentence-by-sentence — NOT the raw JSON token stream")
    void streamAudio_synthesizesParsedGermanNotRawTokens() {
        arrangeStreamFlow(); // parsed reply = "Hallo. Wie geht's?"
        // Raw token stream is structured JSON (content + Vietnamese translation) — must NOT be voiced.
        streamClientStreamsThenCompletes("{\"content\":\"ignore. this?\",", "\"translation\":\"bỏ qua.\"}");
        when(xttsStreamClient.isConfigured()).thenReturn(true);
        when(voiceResolver.resolve(SpeakingPersona.DEFAULT)).thenReturn(Optional.of(TTS_VOICE));
        when(xttsStreamClient.synthesize(eq(TTS_VOICE), anyString(), any())).thenReturn(new byte[]{1});

        service.startStream(USER_ID, SESSION_ID, USER_MESSAGE, emitter, new AtomicBoolean(false), true, finalizer);

        // Synthesizes the PARSED German sentences, in order, with previous_text — never the JSON tokens.
        verify(xttsStreamClient).synthesize(TTS_VOICE, "Hallo.", null);
        verify(xttsStreamClient).synthesize(TTS_VOICE, "Wie geht's?", "Hallo.");
        verify(xttsStreamClient, never()).synthesize(eq(TTS_VOICE), contains("content"), any());
        verify(xttsStreamClient, never()).synthesize(eq(TTS_VOICE), contains("translation"), any());
        verify(emitter).complete();
        verify(emitter, never()).completeWithError(any());
    }

    @Test
    @DisplayName("streamAudio=true but XTTS not configured: no synthesis, text flow unaffected")
    void streamAudio_notConfigured_skipsTts() {
        arrangeStreamFlow();
        streamClientStreamsThenCompletes("Hallo. ");
        when(xttsStreamClient.isConfigured()).thenReturn(false);

        service.startStream(USER_ID, SESSION_ID, USER_MESSAGE, emitter, new AtomicBoolean(false), true, finalizer);

        verify(xttsStreamClient, never()).synthesize(any(), any(), any());
        verify(emitter).complete();
        verify(emitter, never()).completeWithError(any());
    }

    @Test
    @DisplayName("streamAudio=true but persona has no streaming voice (e.g. VN tutor): no synthesis")
    void streamAudio_personaWithoutVoice_skipsTts() {
        arrangeStreamFlow();
        streamClientStreamsThenCompletes("Hallo. ");
        when(xttsStreamClient.isConfigured()).thenReturn(true);
        when(voiceResolver.resolve(SpeakingPersona.DEFAULT)).thenReturn(Optional.empty());

        service.startStream(USER_ID, SESSION_ID, USER_MESSAGE, emitter, new AtomicBoolean(false), true, finalizer);

        verify(xttsStreamClient, never()).synthesize(any(), any(), any());
        verify(emitter).complete();
    }
}
