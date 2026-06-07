package com.deutschflow.user.onboarding;

import com.deutschflow.user.entity.UserLearningProfile.CurrentLevel;
import org.springframework.stereotype.Component;

import static com.deutschflow.user.onboarding.OnboardingType.ASSESSMENT_HOOK;
import static com.deutschflow.user.onboarding.OnboardingType.EXPRESS_PROFILE;
import static com.deutschflow.user.onboarding.OnboardingType.MENTOR_LED_DEMO;
import static com.deutschflow.user.onboarding.OnboardingType.PLACEMENT_VALIDATED;
import static com.deutschflow.user.onboarding.OnboardingType.ZERO_START;
import static com.deutschflow.user.onboarding.PostOnboardingAction.EMAIL_CAPTURE_UPSELL;
import static com.deutschflow.user.onboarding.PostOnboardingAction.INTERVIEW_FIRST;
import static com.deutschflow.user.onboarding.PostOnboardingAction.MOCK_HOOK_PAYWALL;
import static com.deutschflow.user.onboarding.PostOnboardingAction.PRICING_CTA;
import static com.deutschflow.user.onboarding.PostOnboardingAction.RADAR_CHECKOUT;
import static com.deutschflow.user.onboarding.PostOnboardingAction.ROADMAP_ALPHABET;
import static com.deutschflow.user.onboarding.PostOnboardingAction.ROADMAP_NODE;
import static com.deutschflow.user.onboarding.PostOnboardingAction.START_PRACTICE;

/**
 * Resolves the designated onboarding archetype + post-completion action for a learner,
 * implementing the <b>Platform × Level decision matrix</b> from
 * {@code docs/superpowers/specs/2026-06-05-onboarding-type-selection-design.md} §4.
 *
 * <p>Pure and deterministic — single source of truth shared by the web and mobile routers
 * (called over HTTP via {@code GET /api/onboarding/route}). Core invariants:
 * <ul>
 *   <li>iOS never allows an in-app paywall (Apple 3.1.1) → conversion deferred to email/web.</li>
 *   <li>A0 learners skip the placement test (nothing to validate).</li>
 *   <li>Placement is a web-only, <b>optional</b> shortcut offered <i>after</i> the first value
 *       for self-declared A1–B2 learners (value-first redesign 2026-06-07); it no longer gates the roadmap.</li>
 * </ul>
 */
@Component
public class OnboardingTypeResolver {

    /**
     * @param platform access channel (a {@code null} platform is treated as WEB)
     * @param level    self-declared current level (a {@code null} level is treated as A0)
     * @return the routing decision, never {@code null}
     */
    public OnboardingRoute resolve(Platform platform, CurrentLevel level) {
        Platform p = platform == null ? Platform.WEB : platform;
        LevelBand band = LevelBand.of(level);
        boolean paywall = p.allowsInAppPaywall();

        // Field order: type, placementRequired, placementOptional, assessmentHookAfter, paywallAllowed, postAction.
        return switch (p) {
            // WEB: placement is now an optional, skippable shortcut shown AFTER the first value
            // (value-first redesign) — no longer a gate. A0 has nothing to validate.
            case WEB -> switch (band) {
                case ZERO  -> new OnboardingRoute(ZERO_START,          false, false, false, paywall, ROADMAP_ALPHABET);
                case LOWER -> new OnboardingRoute(PLACEMENT_VALIDATED, false, true,  true,  paywall, ROADMAP_NODE);
                case UPPER -> new OnboardingRoute(PLACEMENT_VALIDATED, false, true,  true,  paywall, PRICING_CTA);
            };
            case ANDROID -> switch (band) {
                case ZERO  -> new OnboardingRoute(ZERO_START,      false, false, false, paywall, ROADMAP_ALPHABET);
                case LOWER -> new OnboardingRoute(EXPRESS_PROFILE, false, false, true,  paywall, MOCK_HOOK_PAYWALL);
                case UPPER -> new OnboardingRoute(ASSESSMENT_HOOK, false, false, true,  paywall, RADAR_CHECKOUT);
            };
            // iOS: paywall is always false → clients use EMAIL_CAPTURE handoff for conversion.
            case IOS -> switch (band) {
                case ZERO  -> new OnboardingRoute(MENTOR_LED_DEMO, false, false, false, paywall, EMAIL_CAPTURE_UPSELL);
                case LOWER -> new OnboardingRoute(EXPRESS_PROFILE, false, false, false, paywall, START_PRACTICE);
                case UPPER -> new OnboardingRoute(EXPRESS_PROFILE, false, false, false, paywall, INTERVIEW_FIRST);
            };
        };
    }

    /** CEFR level grouped into the three bands the matrix routes on. */
    private enum LevelBand {
        ZERO,   // A0
        LOWER,  // A1–A2
        UPPER;  // B1–B2 (and C1/C2)

        static LevelBand of(CurrentLevel level) {
            if (level == null) {
                return ZERO;
            }
            return switch (level) {
                case A0 -> ZERO;
                case A1, A2 -> LOWER;
                case B1, B2, C1, C2 -> UPPER;
            };
        }
    }
}
