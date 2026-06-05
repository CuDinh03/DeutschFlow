package com.deutschflow.user.dto;

import com.deutschflow.user.onboarding.OnboardingRoute;

/**
 * Onboarding routing decision for the client (web/mobile), derived from the
 * Platform × Level matrix (design §4). Single source of truth so both routers
 * behave identically.
 *
 * @param onboardingType      primary archetype (O1–O5) name
 * @param placementRequired   run the placement test before the roadmap
 * @param assessmentHookAfter run the mock/diagnostic hook after the core flow
 * @param paywallAllowed      client may show in-app pricing/checkout (false on iOS)
 * @param postAction          where to send the learner after onboarding
 */
public record OnboardingRouteResponse(
        String onboardingType,
        boolean placementRequired,
        boolean assessmentHookAfter,
        boolean paywallAllowed,
        String postAction
) {
    public static OnboardingRouteResponse from(OnboardingRoute route) {
        return new OnboardingRouteResponse(
                route.type().name(),
                route.placementRequired(),
                route.assessmentHookAfter(),
                route.paywallAllowed(),
                route.postAction().name());
    }
}
