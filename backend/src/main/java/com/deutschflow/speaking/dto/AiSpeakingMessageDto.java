package com.deutschflow.speaking.dto;

import java.time.LocalDateTime;
import java.util.List;

public record AiSpeakingMessageDto(
        Long id,
        String role,
        String userText,
        String aiSpeechDe,
        String correction,
        String explanationVi,
        String grammarPoint,
        String newWord,
        String userInterestDetected,
        LocalDateTime createdAt,
        List<ErrorItemDto> errors
) {
    public AiSpeakingMessageDto {
        errors = errors == null ? List.of() : List.copyOf(errors);
    }
}
