package com.deutschflow.user.onboarding;

/** Where the client should send the learner immediately after onboarding completes (design §4). */
public enum PostOnboardingAction {
    /** A0 → start from the alphabet roadmap. */
    ROADMAP_ALPHABET,
    /** Start at the (placement-)validated roadmap node. */
    ROADMAP_NODE,
    /** Jump straight into a practice / speaking session. */
    START_PRACTICE,
    /** Start with a first interview session (upper levels). */
    INTERVIEW_FIRST,
    /** Run the mock/diagnostic, then show the in-app paywall (Android). */
    MOCK_HOOK_PAYWALL,
    /** CEFR radar → in-app PRO checkout (Android). */
    RADAR_CHECKOUT,
    /** Show pricing CTA after value (web). */
    PRICING_CTA,
    /** iOS: capture email and defer conversion to web (no in-app pricing). */
    EMAIL_CAPTURE_UPSELL
}
