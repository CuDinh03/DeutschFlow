package com.deutschflow.speaking.dto;

import java.util.List;

/**
 * Structured end-of-session evaluation for COMMUNICATION / LESSON speaking sessions —
 * the conversational analogue of the interview report. Parsed from the LLM evaluation
 * JSON stored in {@code AiSpeakingSession.interviewReportJson}.
 */
public record ConversationReportDto(
        Long sessionId,
        String topic,
        String levelEstimate,
        Double overallScore,
        String summary,
        List<String> strengths,
        List<String> improvements,
        String grammarAccuracy,
        List<String> commonErrors,
        String vocabulary,
        String fluency,
        List<String> recommendedNext,
        String encouragement
) {
}
