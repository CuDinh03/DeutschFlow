package com.deutschflow.user.onboarding;

import com.deutschflow.user.entity.UserLearningProfile.CurrentLevel;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.stream.Stream;

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
import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link OnboardingTypeResolver}, exercising every cell of the
 * Platform × Level decision matrix (design §4) plus its invariants.
 */
class OnboardingTypeResolverTest {

    private final OnboardingTypeResolver resolver = new OnboardingTypeResolver();

    // ── Full matrix: one assertion per (platform, level) cell ──

    @ParameterizedTest(name = "[{index}] {0} × {1} → {2}")
    @MethodSource("matrix")
    @DisplayName("matrix maps each (platform, level) to the designed route")
    void matrixCells(Platform platform, CurrentLevel level, OnboardingType type,
                     boolean placement, boolean placementOptional, boolean hook,
                     boolean paywall, PostOnboardingAction action) {
        OnboardingRoute r = resolver.resolve(platform, level);
        assertThat(r.type()).isEqualTo(type);
        assertThat(r.placementRequired()).isEqualTo(placement);
        assertThat(r.placementOptional()).isEqualTo(placementOptional);
        assertThat(r.assessmentHookAfter()).isEqualTo(hook);
        assertThat(r.paywallAllowed()).isEqualTo(paywall);
        assertThat(r.postAction()).isEqualTo(action);
    }

    // Columns: platform, level, type, placementRequired, placementOptional, assessmentHookAfter, paywallAllowed, postAction
    private static Stream<Arguments> matrix() {
        return Stream.of(
                // WEB — placement is optional (offered after value), never gating
                Arguments.of(Platform.WEB, CurrentLevel.A0, ZERO_START,          false, false, false, true, ROADMAP_ALPHABET),
                Arguments.of(Platform.WEB, CurrentLevel.A1, PLACEMENT_VALIDATED, false, true,  true,  true, ROADMAP_NODE),
                Arguments.of(Platform.WEB, CurrentLevel.A2, PLACEMENT_VALIDATED, false, true,  true,  true, ROADMAP_NODE),
                Arguments.of(Platform.WEB, CurrentLevel.B1, PLACEMENT_VALIDATED, false, true,  true,  true, PRICING_CTA),
                Arguments.of(Platform.WEB, CurrentLevel.B2, PLACEMENT_VALIDATED, false, true,  true,  true, PRICING_CTA),
                // ANDROID
                Arguments.of(Platform.ANDROID, CurrentLevel.A0, ZERO_START,      false, false, false, true, ROADMAP_ALPHABET),
                Arguments.of(Platform.ANDROID, CurrentLevel.A1, EXPRESS_PROFILE, false, false, true,  true, MOCK_HOOK_PAYWALL),
                Arguments.of(Platform.ANDROID, CurrentLevel.A2, EXPRESS_PROFILE, false, false, true,  true, MOCK_HOOK_PAYWALL),
                Arguments.of(Platform.ANDROID, CurrentLevel.B1, ASSESSMENT_HOOK, false, false, true,  true, RADAR_CHECKOUT),
                Arguments.of(Platform.ANDROID, CurrentLevel.B2, ASSESSMENT_HOOK, false, false, true,  true, RADAR_CHECKOUT),
                // IOS (paywall always false)
                Arguments.of(Platform.IOS, CurrentLevel.A0, MENTOR_LED_DEMO, false, false, false, false, EMAIL_CAPTURE_UPSELL),
                Arguments.of(Platform.IOS, CurrentLevel.A1, EXPRESS_PROFILE, false, false, false, false, START_PRACTICE),
                Arguments.of(Platform.IOS, CurrentLevel.A2, EXPRESS_PROFILE, false, false, false, false, START_PRACTICE),
                Arguments.of(Platform.IOS, CurrentLevel.B1, EXPRESS_PROFILE, false, false, false, false, INTERVIEW_FIRST),
                Arguments.of(Platform.IOS, CurrentLevel.B2, EXPRESS_PROFILE, false, false, false, false, INTERVIEW_FIRST)
        );
    }

    // ── Invariants ──

    @ParameterizedTest
    @EnumSource(CurrentLevel.class)
    @DisplayName("iOS never allows an in-app paywall (Apple 3.1.1)")
    void iosNeverPaywalls(CurrentLevel level) {
        assertThat(resolver.resolve(Platform.IOS, level).paywallAllowed()).isFalse();
    }

    @ParameterizedTest
    @EnumSource(CurrentLevel.class)
    @DisplayName("web and android always allow an in-app paywall")
    void webAndAndroidAlwaysPaywall(CurrentLevel level) {
        assertThat(resolver.resolve(Platform.WEB, level).paywallAllowed()).isTrue();
        assertThat(resolver.resolve(Platform.ANDROID, level).paywallAllowed()).isTrue();
    }

    @ParameterizedTest
    @EnumSource(value = CurrentLevel.class, names = {"A0"})
    @DisplayName("A0 never triggers a placement test (required or optional) on any platform")
    void a0NeverPlacement(CurrentLevel level) {
        for (Platform p : Platform.values()) {
            assertThat(resolver.resolve(p, level).placementRequired())
                    .as("placementRequired for %s/%s", p, level).isFalse();
            assertThat(resolver.resolve(p, level).placementOptional())
                    .as("placementOptional for %s/%s", p, level).isFalse();
        }
    }

    @Test
    @DisplayName("placement never gates the roadmap now; only web offers it (optionally)")
    void placementIsOptionalAndWebOnly() {
        for (CurrentLevel level : CurrentLevel.values()) {
            // Value-first: no platform gates the roadmap on a placement test anymore.
            assertThat(resolver.resolve(Platform.WEB, level).placementRequired()).isFalse();
            assertThat(resolver.resolve(Platform.ANDROID, level).placementRequired()).isFalse();
            assertThat(resolver.resolve(Platform.IOS, level).placementRequired()).isFalse();
            // Optional placement is web-only.
            assertThat(resolver.resolve(Platform.ANDROID, level).placementOptional()).isFalse();
            assertThat(resolver.resolve(Platform.IOS, level).placementOptional()).isFalse();
        }
        // Web offers optional placement for self-declared non-A0 learners.
        assertThat(resolver.resolve(Platform.WEB, CurrentLevel.A0).placementOptional()).isFalse();
        assertThat(resolver.resolve(Platform.WEB, CurrentLevel.A1).placementOptional()).isTrue();
        assertThat(resolver.resolve(Platform.WEB, CurrentLevel.B2).placementOptional()).isTrue();
    }

    // ── Null-safety ──

    @Test
    @DisplayName("null platform is treated as WEB")
    void nullPlatform_isWeb() {
        assertThat(resolver.resolve(null, CurrentLevel.A1))
                .isEqualTo(resolver.resolve(Platform.WEB, CurrentLevel.A1));
    }

    @Test
    @DisplayName("null level is treated as A0 (ZERO band)")
    void nullLevel_isZeroBand() {
        assertThat(resolver.resolve(Platform.WEB, null))
                .isEqualTo(resolver.resolve(Platform.WEB, CurrentLevel.A0));
        assertThat(resolver.resolve(Platform.IOS, null).type()).isEqualTo(MENTOR_LED_DEMO);
    }

    // ── Platform.fromText ──

    @Test
    @DisplayName("Platform.fromText maps client strings leniently")
    void platformFromText() {
        assertThat(Platform.fromText("ios")).isEqualTo(Platform.IOS);
        assertThat(Platform.fromText("iPhone")).isEqualTo(Platform.IOS);
        assertThat(Platform.fromText("android")).isEqualTo(Platform.ANDROID);
        assertThat(Platform.fromText("web")).isEqualTo(Platform.WEB);
        assertThat(Platform.fromText(null)).isEqualTo(Platform.WEB);
        assertThat(Platform.fromText("  ")).isEqualTo(Platform.WEB);
        assertThat(Platform.fromText("unknown")).isEqualTo(Platform.WEB);
        assertThat(Platform.IOS.allowsInAppPaywall()).isFalse();
        assertThat(Platform.WEB.allowsInAppPaywall()).isTrue();
        assertThat(Platform.ANDROID.allowsInAppPaywall()).isTrue();
    }
}
