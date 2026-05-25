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
        String action,
        /** Interview mode optional structured interviewer lines. */
        @JsonProperty("interview_meta") InterviewMeta interviewMeta
) {
    public record InterviewMeta(
            @JsonProperty("ack_de") String ackDe,
            @JsonProperty("question_de") String questionDe,
            @JsonProperty("question_type") String questionType
    ) {}

    public AiResponseDto {
        errors = errors == null ? List.of() : List.copyOf(errors);
        suggestions = suggestions == null ? List.of() : List.copyOf(suggestions);
    }

    /** Constructor without interview_meta (communication / legacy). */
    public AiResponseDto(
            String aiSpeechDe, String correction, String explanationVi, String grammarPoint,
            String newWord, String userInterestDetected, List<ErrorItem> errors,
            String status, Double similarityScore, String feedback,
            List<AiSuggestionDto> suggestions, String action) {
        this(aiSpeechDe, correction, explanationVi, grammarPoint, newWord, userInterestDetected, errors,
                status, similarityScore, feedback, suggestions, action, null);
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
