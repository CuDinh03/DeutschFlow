package com.deutschflow.user.mentor;

/**
 * One entry in the fixed-mentor catalog: a persona code, its industry family, and
 * its difficulty tier. Mirrors a row of SRS §59.3 / the {@code interview_persona}
 * table and the {@code SpeakingPersona} enum.
 *
 * @param code       persona code (e.g. {@code "LUKAS"}); stored on
 *                   {@code user_learning_profiles.assigned_persona_code}
 * @param family     industry family the persona belongs to
 * @param difficulty conversation-difficulty tier (gates FREE vs PRO)
 */
public record MentorPersona(String code, IndustryFamily family, MentorDifficulty difficulty) {}
