package com.deutschflow.speaking.interview;

/**
 * Difficulty band for interview question selection, calibrated to the candidate's chosen level
 * (CEFR + experience). Used by {@link LevelCalibrator} and {@link PersonaInterviewRegistry} so the
 * interviewer asks questions that fit the candidate — "sharp to the chosen level".
 */
public enum QuestionDifficulty {
    BEGINNER,
    INTERMEDIATE,
    ADVANCED;

    /** Band distance (0 = same band, 1 = adjacent, 2 = opposite ends). */
    public int distanceTo(QuestionDifficulty other) {
        return Math.abs(this.ordinal() - other.ordinal());
    }
}
