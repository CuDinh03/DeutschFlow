-- Fixed-mentor assignment + level provenance for onboarding (Phase 0-1).
--
-- assigned_persona_code: the user's default Speaking/Interview mentor, derived
--   deterministically by FixedMentorResolver from goal_type + industry +
--   current_level + subscription tier, then persisted at onboarding. Storing it
--   (rather than recomputing on read) makes the assignment reproducible on audit
--   and survives catalog/tier changes. Mirrors interview_persona.code /
--   SpeakingPersona enum names (e.g. 'ANNA', 'LUKAS', 'KLAUS').
--
-- level_source: how current_level was established — 'SELF' (self-declared during
--   onboarding) or 'PLACEMENT' (validated by the placement test). Lets downstream
--   adaptive logic weight currentLevel confidence. Defaults to 'SELF'; the
--   placement-test flow overwrites it to 'PLACEMENT' when it updates current_level.
--
-- Existing rows are left with assigned_persona_code = NULL (consumers fall back to
-- the default mentor) and level_source = 'SELF'; they get a real mentor the next
-- time the user submits onboarding.
ALTER TABLE user_learning_profiles
    ADD COLUMN IF NOT EXISTS assigned_persona_code VARCHAR(32),
    ADD COLUMN IF NOT EXISTS level_source          VARCHAR(20) DEFAULT 'SELF';
