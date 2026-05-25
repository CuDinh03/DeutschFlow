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
        String action,
        
        /** Signal frontend that backend has auto-closed this session. */
        Boolean isSessionEnded,

        /** Interview mode: orchestrator phase key (INTRO, ICE_BREAKER, HARD_SKILLS, STAR_SOFT, CLOSING). */
        String interviewPhaseKey,

        /** Interview mode: short hint for the learner (i18n key suffix or German hint). */
        String interviewHintKey
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
