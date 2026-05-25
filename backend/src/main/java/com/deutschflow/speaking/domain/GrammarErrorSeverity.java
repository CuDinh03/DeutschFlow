package com.deutschflow.speaking.domain;

/**
 * Canonical severity values stored in {@code user_grammar_errors.severity}
 * and used in structured {@code errors[]} from the AI.
 */
public enum GrammarErrorSeverity {
    BLOCKING,
    MAJOR,
    MINOR;

    /** Normalize legacy or mixed-case values to enum names. */
    public static String normalizeToStored(String raw) {
        if (raw == null || raw.isBlank()) {
            return MINOR.name();
        }
        return switch (raw.trim().toUpperCase()) {
            case "HIGH", "CRITICAL", "BLOCKING" -> BLOCKING.name();
            case "MEDIUM", "MAJOR" -> MAJOR.name();
            case "LOW", "MINOR" -> MINOR.name();
            default -> MINOR.name();
        };
    }
}
