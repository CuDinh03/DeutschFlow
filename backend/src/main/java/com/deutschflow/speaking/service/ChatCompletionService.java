package com.deutschflow.speaking.service;

import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.AiErrorSanitizer;
import com.deutschflow.speaking.ai.AiParseOutcome;
import com.deutschflow.speaking.ai.AiResponseDto;
import com.deutschflow.speaking.ai.AiResponseParser;
import com.deutschflow.speaking.ai.GroqChatClient;
import com.deutschflow.speaking.ai.OpenAiChatClient;
import com.deutschflow.speaking.contract.SpeakingSessionMode;
import com.deutschflow.speaking.interview.InterviewSpeechSanitizer;
import com.deutschflow.speaking.interview.InterviewTurnPlan;
import com.deutschflow.speaking.metrics.SpeakingMetrics;
import org.springframework.stereotype.Service;

/**
 * AI-completion execution + response-parsing core extracted from {@code AiSpeakingServiceImpl}.
 *
 * <p>Owns the blocking model call, client selection (OpenAI vs Groq), structured-response
 * parsing and interview-mode post-processing. The SSE streaming lifecycle stays on the facade
 * (it couples to the emitter and the {@code finalizeSpeakingChatPersistence} callback) and
 * delegates back into this service via {@link #parseAndPostProcess} / {@link #chatClientFor}.
 *
 * <p><strong>No transaction boundary here.</strong> The model call runs outside any transaction
 * (so no JDBC connection is held during LLM latency); read/write transactions remain on the
 * facade's {@code transactionTemplate}.
 */
@Service
public class ChatCompletionService {

    /** Lower-variance JSON / tutor replies for structured V1/V2. */
    private static final double SPEAKING_CHAT_TEMPERATURE = 0.35;

    private final OpenAiChatClient openAiChatClient;
    /** Interview mode forces this hosted client for reliable structured JSON (see {@link #chatClientFor}). */
    private final GroqChatClient groqChatClient;
    private final AiResponseParser responseParser;
    private final SpeakingMetrics speakingMetrics;
    private final InterviewSpeechSanitizer interviewSpeechSanitizer;
    private final com.deutschflow.system.service.SystemConfigService systemConfigService;

    public ChatCompletionService(
            OpenAiChatClient openAiChatClient,
            GroqChatClient groqChatClient,
            AiResponseParser responseParser,
            SpeakingMetrics speakingMetrics,
            InterviewSpeechSanitizer interviewSpeechSanitizer,
            com.deutschflow.system.service.SystemConfigService systemConfigService) {
        this.openAiChatClient = openAiChatClient;
        this.groqChatClient = groqChatClient;
        this.responseParser = responseParser;
        this.speakingMetrics = speakingMetrics;
        this.interviewSpeechSanitizer = interviewSpeechSanitizer;
        this.systemConfigService = systemConfigService;
    }

    public AiChatCompletionResult runChatCompletion(AiSpeakingServiceImpl.SpeakingChatPrep prep) {
        Double tempConfig = systemConfigService.getDouble("ai.temperature", SPEAKING_CHAT_TEMPERATURE);
        return chatClientFor(prep.sessionMode())
                .chatCompletion(prep.openAiMessages(), null, tempConfig, prep.maxTokens());
    }

    /**
     * Interview mode forces Groq: the structured {@code interview_meta} (analysis + ack/question)
     * parses far more reliably on the hosted model than on the local one. Other modes use the
     * configured primary client ({@link AiChatClientFactory}).
     */
    public OpenAiChatClient chatClientFor(SpeakingSessionMode mode) {
        return mode == SpeakingSessionMode.INTERVIEW ? groqChatClient : openAiChatClient;
    }

    public AiResponseDto parseAndPostProcess(AiChatCompletionResult ai, String userMessage,
                                             AiSpeakingServiceImpl.SpeakingChatPrep prep) {
        AiParseOutcome parseOutcome = responseParser.parseWithOutcome(ai.content(), prep.responseSchema());
        speakingMetrics.recordAiParseOutcome(parseOutcome.status());
        return applyInterviewPostProcessing(parseOutcome.dto(), userMessage, prep);
    }

    public AiResponseDto applyInterviewPostProcessing(AiResponseDto parsedRaw, String userMessage,
                                                      AiSpeakingServiceImpl.SpeakingChatPrep prep) {
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
}
