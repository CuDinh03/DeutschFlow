package com.deutschflow.speaking.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record AiResponseDto(
        @JsonProperty("ai_speech_de") String aiSpeechDe,
        String correction,
        @JsonProperty("explanation_vi") String explanationVi,
        @JsonProperty("grammar_point") String grammarPoint,
        String newWord,
        String userInterestDetected,
        List<ErrorItem> errors,
        
        // Revised fields for "STRICT JSON" from AI Tutor prompt
        String status, // OFF_TOPIC | ON_TOPIC_NEEDS_IMPROVEMENT | EXCELLENT
        @JsonProperty("similarity_score") Double similarityScore,
        String feedback,
        List<AiSuggestionDto> suggestions,
        /** V2 compact contract: next step / follow-up question. */
        String action
) {
    public AiResponseDto {
        errors = errors == null ? List.of() : List.copyOf(errors);
        suggestions = suggestions == null ? List.of() : List.copyOf(suggestions);
    }

    public record AiSuggestionDto(
            @JsonProperty("german_text") String germanText,
            @JsonProperty("vietnamese_translation") String vietnameseTranslation,
            String level,
            @JsonProperty("why_to_use") String whyToUse,
            @JsonProperty("usage_context") String usageContext,
            @JsonProperty("lego_structure") String legoStructure
    ) {}
}
