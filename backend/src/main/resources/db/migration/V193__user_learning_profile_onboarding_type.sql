-- Onboarding-type provenance (Phase 2). Records which of the 5 onboarding
-- archetypes (O1-O5) a learner was routed through, derived by
-- OnboardingTypeResolver from platform (web/iOS/Android) x current_level.
-- Used for the per-cell conversion funnel + A/B analysis. Nullable: profiles
-- created before this column, and clients that don't send `platform`, stay NULL.
ALTER TABLE user_learning_profiles
    ADD COLUMN IF NOT EXISTS onboarding_type VARCHAR(32);
