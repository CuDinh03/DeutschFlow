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
        AdaptiveMetaDto adaptive,
        
        // New fields
        String status,
        Double similarityScore,
        String feedback,
        List<SuggestionDto> suggestions,
        /** V1 | V2 — parallel JSON contracts. */
        String responseSchema,
        /** V2: follow-up suggestion / question from the model. */
        String action
) {
    public AiSpeakingChatResponse {
        errors = errors == null ? List.of() : List.copyOf(errors);
        suggestions = suggestions == null ? List.of() : List.copyOf(suggestions);
    }

    public record LearningStatus(
            String newWord,
            String userInterestDetected
    ) {}

    public record SuggestionDto(
            String germanText,
            String vietnameseTranslation,
            String level,
            String whyToUse,
            String usageContext,
            String legoStructure
    ) {}
}
