package com.deutschflow.user.onboarding;

/**
 * Resolved onboarding routing for a (platform, level) cell of the design §4 matrix.
 *
 * @param type                primary onboarding archetype to run
 * @param placementRequired   whether a placement test must run (gating) before the roadmap
 * @param placementOptional   whether placement is offered as a skippable shortcut <i>after</i>
 *                            the first value (value-first redesign). Never true together with
 *                            {@code placementRequired}; web-only.
 * @param assessmentHookAfter whether to run the mock/diagnostic hook after the core flow
 * @param paywallAllowed      whether the client may show in-app pricing/checkout
 *                            (false on iOS → use {@link PostOnboardingAction#EMAIL_CAPTURE_UPSELL})
 * @param postAction          where to send the learner after onboarding
 */
public record OnboardingRoute(
        OnboardingType type,
        boolean placementRequired,
        boolean placementOptional,
        boolean assessmentHookAfter,
        boolean paywallAllowed,
        PostOnboardingAction postAction
) {}
