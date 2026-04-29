package com.deutschflow.speaking.ai;

public record AiResponseDto(
        String aiSpeechDe,
        String correction,
        String explanationVi,
        String grammarPoint,
        String newWord,
        String userInterestDetected
) {}
