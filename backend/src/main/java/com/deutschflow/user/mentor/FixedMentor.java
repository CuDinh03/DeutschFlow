package com.deutschflow.user.mentor;

/**
 * Result of fixed-mentor resolution.
 *
 * @param code       persona code to persist on
 *                   {@code user_learning_profiles.assigned_persona_code}
 * @param difficulty the resolved persona's difficulty tier
 * @param reason     short, deterministic explanation of why this mentor was chosen
 *                   (for logs, analytics, and test assertions)
 */
public record FixedMentor(String code, MentorDifficulty difficulty, String reason) {}
