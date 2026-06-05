package com.deutschflow.user.onboarding;

/**
 * The five onboarding archetypes (O1–O5) from the type-selection design (§2).
 * Persisted on {@code user_learning_profiles.onboarding_type} for the conversion funnel.
 */
public enum OnboardingType {
    /** O1 — fastest TTV: self-declared level → auto-mentor → start. */
    EXPRESS_PROFILE,
    /** O2 — placement test validates the level before the roadmap. */
    PLACEMENT_VALIDATED,
    /** O3 — A0 learners skip placement and start from the alphabet. */
    ZERO_START,
    /** O4 — mock/diagnostic → CEFR radar → soft paywall (needs in-app paywall). */
    ASSESSMENT_HOOK,
    /** O5 — emotional hook: first guided speaking turn with the fixed mentor (works on iOS). */
    MENTOR_LED_DEMO
}
