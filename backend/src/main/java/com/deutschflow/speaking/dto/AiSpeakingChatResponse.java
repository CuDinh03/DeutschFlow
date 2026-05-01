package com.deutschflow.speaking.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record AiSpeakingChatResponse(
        Long messageId,
        Long sessionId,
        String aiSpeechDe,
        String correction,
        String explanationVi,
        String grammarPoint,
        LearningStatus learningStatus,
        List<ErrorItemDto> errors,
        AdaptiveMetaDto adaptive
) {
    public AiSpeakingChatResponse {
        errors = errors == null ? List.of() : List.copyOf(errors);
    }

    public record LearningStatus(
            String newWord,
            String userInterestDetected
    ) {}
}
