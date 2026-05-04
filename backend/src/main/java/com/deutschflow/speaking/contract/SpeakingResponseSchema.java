package com.deutschflow.speaking.contract;

import java.util.Locale;

/**
 * AI Speaking JSON contract version (parallel run).
 * V1: canonical structured tutor (ai_speech_de, errors, suggestions, …).
 * V2: compact persona-oriented (content, translation, feedback, action).
 */
public enum SpeakingResponseSchema {
    V1,
    V2;

    public static SpeakingResponseSchema fromApi(String raw) {
        if (raw == null || raw.isBlank()) {
            return V1;
        }
        try {
            return valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return V1;
        }
    }
}
