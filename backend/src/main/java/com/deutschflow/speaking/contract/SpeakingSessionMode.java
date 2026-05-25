package com.deutschflow.speaking.contract;

import java.util.Locale;

/**
 * Communication = general tutor chat; Interview = interviewer role-play; Lesson = vocabulary drill (special personas).
 */
public enum SpeakingSessionMode {
    COMMUNICATION,
    INTERVIEW,
    /** Vietnamese tutor mode: teaches alphabet, numbers, street names via conversation. */
    LESSON;

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
