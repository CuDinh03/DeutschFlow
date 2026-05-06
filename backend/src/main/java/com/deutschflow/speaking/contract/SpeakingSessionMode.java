package com.deutschflow.speaking.contract;

import java.util.Locale;

/**
 * Communication = general tutor chat; Interview = interviewer role-play (stricter feedback + questions).
 */
public enum SpeakingSessionMode {
    COMMUNICATION,
    INTERVIEW;

    public static SpeakingSessionMode fromApi(String raw) {
        if (raw == null || raw.isBlank()) {
            return COMMUNICATION;
        }
        try {
            return valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return COMMUNICATION;
        }
    }
}
