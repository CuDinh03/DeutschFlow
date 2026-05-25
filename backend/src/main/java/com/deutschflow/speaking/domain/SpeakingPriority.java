package com.deutschflow.speaking.domain;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;

/**
 * Shared priority scoring for error skills (matches legacy aggregate weighting).
 */
public final class SpeakingPriority {

    private SpeakingPriority() {
    }

    public static double severityWeight(String severity) {
        if (severity == null) {
            return 1.0;
        }
        return switch (severity.trim().toUpperCase()) {
            case "BLOCKING", "HIGH", "CRITICAL" -> 3.0;
            case "MAJOR", "MEDIUM" -> 2.0;
            case "MINOR", "LOW" -> 1.0;
            default -> 1.0;
        };
    }

    public static double skillScore(long count, LocalDateTime lastSeen, String severity) {
        double w = severityWeight(severity);
        long daysSince = lastSeen != null
                ? Math.max(0, ChronoUnit.DAYS.between(lastSeen.toLocalDate(), LocalDateTime.now().toLocalDate()))
                : 0;
        return w * count / Math.sqrt(daysSince + 1.0);
    }
}
