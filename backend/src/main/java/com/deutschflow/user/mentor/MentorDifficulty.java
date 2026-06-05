package com.deutschflow.user.mentor;

/**
 * Conversation-difficulty tier of a mentor persona.
 *
 * <p>Mirrors {@code interview_persona.difficulty} (SRS §59.3). Ordinal order
 * matters: {@link FixedMentorResolver} uses {@code ordinal()} to pick the
 * persona whose difficulty is closest to a learner's level.
 */
public enum MentorDifficulty {
    BEGINNER,
    INTERMEDIATE,
    ADVANCED
}
