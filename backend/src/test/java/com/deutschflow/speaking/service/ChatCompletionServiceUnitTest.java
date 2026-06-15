package com.deutschflow.speaking.service;

import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.AiParseOutcome;
import com.deutschflow.speaking.ai.AiParseStatus;
import com.deutschflow.speaking.ai.AiResponseDto;
import com.deutschflow.speaking.ai.GroqChatClient;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.ai.AiResponseParser;
import com.deutschflow.speaking.contract.SpeakingResponseSchema;
import com.deutschflow.speaking.contract.SpeakingSessionMode;
import com.deutschflow.speaking.interview.InterviewDirectiveType;
import com.deutschflow.speaking.interview.InterviewPhase;
import com.deutschflow.speaking.interview.InterviewPromptContext;
import com.deutschflow.speaking.interview.InterviewSessionState;
import com.deutschflow.speaking.interview.InterviewSpeechSanitizer;
import com.deutschflow.speaking.interview.InterviewTurnPlan;
import com.deutschflow.speaking.metrics.SpeakingMetrics;
import com.deutschflow.system.service.SystemConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Real-behavior unit tests for {@link ChatCompletionService} — the AI-completion + parsing
 * core extracted from {@code AiSpeakingServiceImpl}. Covers client selection per session mode,
 * parse-then-post-process wiring (metric recorded, error sanitization), and the interview-mode
 * speech composition. All collaborators are mocked.
 */
@ExtendWith(MockitoExtension.class)
class ChatCompletionServiceUnitTest {

    @Mock OpenAiChatClient openAiChatClient;
    @Mock GroqChatClient groqChatClient;
    @Mock AiResponseParser responseParser;
    @Mock SpeakingMetrics speakingMetrics;
    @Mock InterviewSpeechSanitizer interviewSpeechSanitizer;
    @Mock SystemConfigService systemConfigService;

    ChatCompletionService service;

    @BeforeEach
    void setUp() {
        // Explicit constructor wiring: openAiChatClient and groqChatClient are BOTH OpenAiChatClient
        // (GroqChatClient implements it), so @InjectMocks cannot disambiguate by type — wire by hand
        // to guarantee each mock lands in the correct constructor slot.
        service = new ChatCompletionService(
                openAiChatClient, groqChatClient, responseParser,
                speakingMetrics, interviewSpeechSanitizer, systemConfigService);
    }

    // ---- SpeakingChatPrep builder (only the fields these methods read need to be meaningful) ----

    private AiSpeakingServiceImpl.SpeakingChatPrep prep(SpeakingSessionMode mode,
                                                        SpeakingResponseSchema schema,
                                                        InterviewPromptContext interviewContext) {
        return new AiSpeakingServiceImpl.SpeakingChatPrep(
                1L, 2L, null, "system", "B1", "topic",
                List.of(), 600, 0, schema, mode, interviewContext, null, Instant.now(),
                com.deutschflow.speaking.persona.SpeakingPersona.DEFAULT);
    }

    private static InterviewTurnPlan plan(int userTurn) {
        return new InterviewTurnPlan(
                userTurn, InterviewPhase.fromUserTurn(userTurn), InterviewDirectiveType.STANDARD,
                "Standard-Follow-up.", "Was war Ihr letzter Erfolg?", "q1", "general",
                8, InterviewTurnPlan.DEFAULT_FORBIDDEN, null, false);
    }

    private static InterviewPromptContext interviewContext(int userTurn) {
        InterviewSessionState state = InterviewSessionState.initial(123, "general");
        return new InterviewPromptContext(state, plan(userTurn));
    }

    private static AiResponseDto dto(String speech, AiResponseDto.InterviewMeta meta) {
        return new AiResponseDto(
                speech, null, null, null, null, null,
                List.of(), "ON_TOPIC", null, null, null, null, meta);
    }

    private static AiChatCompletionResult aiResult(String content) {
        return new AiChatCompletionResult(content, null, "GROQ", "model");
    }

    // ---------------------------------------------------------------------
    // chatClientFor — client selection by session mode
    // ---------------------------------------------------------------------

    @Test
    @DisplayName("chatClientFor returns the Groq client for INTERVIEW mode")
    void chatClientFor_interviewMode_returnsGroqClient() {
        assertThat(service.chatClientFor(SpeakingSessionMode.INTERVIEW)).isSameAs(groqChatClient);
    }

    @Test
    @DisplayName("chatClientFor returns the OpenAI/primary client for COMMUNICATION mode")
    void chatClientFor_communicationMode_returnsOpenAiClient() {
        assertThat(service.chatClientFor(SpeakingSessionMode.COMMUNICATION)).isSameAs(openAiChatClient);
    }

    @Test
    @DisplayName("chatClientFor returns the OpenAI/primary client for LESSON mode")
    void chatClientFor_lessonMode_returnsOpenAiClient() {
        assertThat(service.chatClientFor(SpeakingSessionMode.LESSON)).isSameAs(openAiChatClient);
    }

    // ---------------------------------------------------------------------
    // runChatCompletion — uses the mode-selected client + configured temperature
    // ---------------------------------------------------------------------

    @Test
    @DisplayName("runChatCompletion calls the Groq client in INTERVIEW mode with the configured temperature and prep tokens")
    void runChatCompletion_interview_usesGroqWithConfiguredTemperature() {
        // Arrange
        when(systemConfigService.getDouble(eq("ai.temperature"), any())).thenReturn(0.5);
        AiChatCompletionResult expected = aiResult("hi");
        when(groqChatClient.chatCompletion(any(), eq(null), eq(0.5), eq(600))).thenReturn(expected);

        // Act
        AiChatCompletionResult result = service.runChatCompletion(
                prep(SpeakingSessionMode.INTERVIEW, SpeakingResponseSchema.V1, null));

        // Assert
        assertThat(result).isSameAs(expected);
        verify(groqChatClient).chatCompletion(any(), eq(null), eq(0.5), eq(600));
        verify(openAiChatClient, never()).chatCompletion(any(), any(), anyDouble(), any());
    }

    @Test
    @DisplayName("runChatCompletion calls the OpenAI client in COMMUNICATION mode")
    void runChatCompletion_communication_usesOpenAi() {
        // Arrange — getDouble falls back to the service default when unset
        when(systemConfigService.getDouble(eq("ai.temperature"), any())).thenReturn(0.35);
        AiChatCompletionResult expected = aiResult("hallo");
        when(openAiChatClient.chatCompletion(any(), eq(null), eq(0.35), eq(600))).thenReturn(expected);

        // Act
        AiChatCompletionResult result = service.runChatCompletion(
                prep(SpeakingSessionMode.COMMUNICATION, SpeakingResponseSchema.V1, null));

        // Assert
        assertThat(result).isSameAs(expected);
        verify(openAiChatClient).chatCompletion(any(), eq(null), eq(0.35), eq(600));
    }

    // ---------------------------------------------------------------------
    // parseAndPostProcess — parser invoked with the prep schema + metric recorded
    // ---------------------------------------------------------------------

    @Test
    @DisplayName("parseAndPostProcess parses with the prep response schema and records the parse-outcome metric")
    void parseAndPostProcess_recordsMetricAndReturnsDto() {
        // Arrange
        AiResponseDto parsed = dto("Sehr gut.", null);
        when(responseParser.parseWithOutcome("raw-json", SpeakingResponseSchema.V2))
                .thenReturn(new AiParseOutcome(parsed, AiParseStatus.STRUCTURED));

        // Act — COMMUNICATION mode → no interview post-processing, dto passes through (errors sanitized)
        AiResponseDto result = service.parseAndPostProcess(
                aiResult("raw-json"), "ich gestern ging",
                prep(SpeakingSessionMode.COMMUNICATION, SpeakingResponseSchema.V2, null));

        // Assert
        verify(responseParser).parseWithOutcome("raw-json", SpeakingResponseSchema.V2);
        verify(speakingMetrics).recordAiParseOutcome(AiParseStatus.STRUCTURED);
        assertThat(result.aiSpeechDe()).isEqualTo("Sehr gut.");
        // sanitizer untouched outside interview mode
        verify(interviewSpeechSanitizer, never()).composeFromMeta(any(), any(), any(), anyInt());
        verify(interviewSpeechSanitizer, never()).sanitize(any(), any(), anyInt());
    }

    // ---------------------------------------------------------------------
    // applyInterviewPostProcessing — non-interview passthrough vs interview composition
    // ---------------------------------------------------------------------

    @Test
    @DisplayName("applyInterviewPostProcessing returns the base dto unchanged when not in interview mode")
    void applyInterviewPostProcessing_communicationMode_passthrough() {
        // Arrange
        AiResponseDto raw = dto("Original speech.", null);

        // Act
        AiResponseDto result = service.applyInterviewPostProcessing(
                raw, "user said", prep(SpeakingSessionMode.COMMUNICATION, SpeakingResponseSchema.V1, null));

        // Assert — speech preserved, sanitizer never consulted
        assertThat(result.aiSpeechDe()).isEqualTo("Original speech.");
        verify(interviewSpeechSanitizer, never()).composeFromMeta(any(), any(), any(), anyInt());
        verify(interviewSpeechSanitizer, never()).sanitize(any(), any(), anyInt());
    }

    @Test
    @DisplayName("applyInterviewPostProcessing returns base when interviewContext is null even in INTERVIEW mode")
    void applyInterviewPostProcessing_interviewModeNullContext_passthrough() {
        // Arrange
        AiResponseDto raw = dto("Original speech.", null);

        // Act
        AiResponseDto result = service.applyInterviewPostProcessing(
                raw, "user said", prep(SpeakingSessionMode.INTERVIEW, SpeakingResponseSchema.V1, null));

        // Assert
        assertThat(result.aiSpeechDe()).isEqualTo("Original speech.");
        verify(interviewSpeechSanitizer, never()).composeFromMeta(any(), any(), any(), anyInt());
        verify(interviewSpeechSanitizer, never()).sanitize(any(), any(), anyInt());
    }

    @Test
    @DisplayName("applyInterviewPostProcessing with interview_meta composes speech from ack + question via the sanitizer")
    void applyInterviewPostProcessing_withMeta_composesFromMeta() {
        // Arrange
        AiResponseDto.InterviewMeta meta =
                new AiResponseDto.InterviewMeta("Danke.", "Was war Ihr letzter Erfolg?", "COVERAGE");
        AiResponseDto raw = dto("ignored-when-meta-present", meta);
        when(interviewSpeechSanitizer.composeFromMeta(eq("Danke."), eq("Was war Ihr letzter Erfolg?"),
                any(InterviewTurnPlan.class), eq(3))).thenReturn("Danke. Was war Ihr letzter Erfolg?");

        // Act — userTurn 3 from the plan
        AiResponseDto result = service.applyInterviewPostProcessing(
                raw, "user said", prep(SpeakingSessionMode.INTERVIEW, SpeakingResponseSchema.V1, interviewContext(3)));

        // Assert — composed speech used; composeFromMeta path (not sanitize)
        assertThat(result.aiSpeechDe()).isEqualTo("Danke. Was war Ihr letzter Erfolg?");
        verify(interviewSpeechSanitizer).composeFromMeta(eq("Danke."), eq("Was war Ihr letzter Erfolg?"),
                any(InterviewTurnPlan.class), eq(3));
        verify(interviewSpeechSanitizer, never()).sanitize(any(), any(), anyInt());
    }

    @Test
    @DisplayName("applyInterviewPostProcessing without interview_meta sanitizes the raw aiSpeechDe instead")
    void applyInterviewPostProcessing_noMeta_sanitizesSpeech() {
        // Arrange — no interview_meta on the dto → sanitize() branch
        AiResponseDto raw = dto("Rohtext der Antwort.", null);
        when(interviewSpeechSanitizer.sanitize(eq("Rohtext der Antwort."), any(InterviewTurnPlan.class), eq(2)))
                .thenReturn("Bereinigter Text.");

        // Act — userTurn 2
        AiResponseDto result = service.applyInterviewPostProcessing(
                raw, "user said", prep(SpeakingSessionMode.INTERVIEW, SpeakingResponseSchema.V1, interviewContext(2)));

        // Assert
        assertThat(result.aiSpeechDe()).isEqualTo("Bereinigter Text.");
        verify(interviewSpeechSanitizer).sanitize(eq("Rohtext der Antwort."), any(InterviewTurnPlan.class), eq(2));
        verify(interviewSpeechSanitizer, never()).composeFromMeta(any(), any(), any(), anyInt());
    }

    // anyDouble helper for static-import readability
    private static double anyDouble() {
        return org.mockito.ArgumentMatchers.anyDouble();
    }
}
