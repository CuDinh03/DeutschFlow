package com.deutschflow.speaking.dto;

import java.util.List;

/**
 * Runtime adaptive policy for one speaking turn (prompt injection + client hints).
 */
public record SpeakingPolicy(
        boolean enabled,
        String cefrEffective,
        int difficultyKnob,
        List<String> focusCodes,
        List<String> bannedCodes,
        List<String> targetStructures,
        String topicSuggestion,
        boolean forceRepairBeforeContinue,
        String primaryRepairErrorCode,
        String explanationForLearner
) {
    public static SpeakingPolicy disabled(String sessionCefrOrDefault) {
        String lvl = sessionCefrOrDefault != null && !sessionCefrOrDefault.isBlank()
                ? sessionCefrOrDefault.trim().toUpperCase() : "A1";
        return new SpeakingPolicy(false, lvl, 0, List.of(), List.of(), List.of(), null, false, null,
                "Adaptive personalization is off.");
    }
}
