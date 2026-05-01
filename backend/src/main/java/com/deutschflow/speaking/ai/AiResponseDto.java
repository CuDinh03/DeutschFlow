package com.deutschflow.speaking.ai;

import java.util.List;

public record AiResponseDto(
        String aiSpeechDe,
        String correction,
        String explanationVi,
        String grammarPoint,
        String newWord,
        String userInterestDetected,
        List<ErrorItem> errors
) {
    public AiResponseDto {
        errors = errors == null ? List.of() : List.copyOf(errors);
    }
}
