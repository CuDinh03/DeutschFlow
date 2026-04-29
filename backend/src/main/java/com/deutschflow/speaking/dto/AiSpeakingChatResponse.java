package com.deutschflow.speaking.dto;

public record AiSpeakingChatResponse(
        Long messageId,
        Long sessionId,
        String aiSpeechDe,
        String correction,
        String explanationVi,
        String grammarPoint,
        LearningStatus learningStatus
) {
    public record LearningStatus(
            String newWord,
            String userInterestDetected
    ) {}
}
