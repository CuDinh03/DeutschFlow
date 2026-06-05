package com.deutschflow.user.mentor;

import com.deutschflow.speaking.persona.SpeakingPersona;
import com.deutschflow.user.entity.UserLearningProfile.CurrentLevel;
import com.deutschflow.user.entity.UserLearningProfile.GoalType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for {@link FixedMentorResolver}, exercising the §3.1 decision table from
 * {@code docs/superpowers/specs/2026-06-05-onboarding-type-selection-design.md}.
 */
class FixedMentorResolverTest {

    private static final String PRO = "PRO";
    private static final String FREE = "FREE";

    private final FixedMentorResolver resolver = new FixedMentorResolver();

    // ── (1) CERT goal → generalist exam coach (ANNA), regardless of industry/tier/level ──

    @Nested
    @DisplayName("CERT goal always resolves to ANNA")
    class CertGoal {

        @Test
        @DisplayName("CERT + IT industry + PRO + B2 still resolves to ANNA")
        void cert_ignoresIndustryAndTier() {
            FixedMentor m = resolver.resolve(GoalType.CERT, "Software Engineer", CurrentLevel.B2, PRO);
            assertThat(m.code()).isEqualTo("ANNA");
            assertThat(m.difficulty()).isEqualTo(MentorDifficulty.BEGINNER);
        }

        @Test
        @DisplayName("CERT + no industry + FREE + A0 resolves to ANNA")
        void cert_blankIndustryFreeTier() {
            FixedMentor m = resolver.resolve(GoalType.CERT, null, CurrentLevel.A0, FREE);
            assertThat(m.code()).isEqualTo("ANNA");
        }
    }

    // ── (2)+(4) WORK + industry → family, with the FREE tier gate ──

    @Nested
    @DisplayName("WORK goal maps industry to a mentor")
    class WorkGoalIndustryMapping {

        @Test
        @DisplayName("IT + PRO + B2 → LUKAS (ADVANCED)")
        void it_premium() {
            FixedMentor m = resolver.resolve(GoalType.WORK, "IT / Software", CurrentLevel.B2, PRO);
            assertThat(m.code()).isEqualTo("LUKAS");
            assertThat(m.difficulty()).isEqualTo(MentorDifficulty.ADVANCED);
        }

        @Test
        @DisplayName("IT + PRO + A1 → LUKAS (industry match wins; difficulty is a soft preference)")
        void it_premium_beginnerLevel_stillIndustryMatch() {
            FixedMentor m = resolver.resolve(GoalType.WORK, "Informatik", CurrentLevel.A1, PRO);
            assertThat(m.code()).isEqualTo("LUKAS");
        }

        @Test
        @DisplayName("IT + FREE → ANNA (IT has no BEGINNER persona; tier gate falls back to default)")
        void it_free_fallsBackToDefault() {
            FixedMentor m = resolver.resolve(GoalType.WORK, "Software Developer", CurrentLevel.A1, FREE);
            assertThat(m.code()).isEqualTo("ANNA");
            assertThat(m.reason()).contains("FREE").contains("default");
        }

        @Test
        @DisplayName("Gastronomy + PRO + A2 → KLAUS (INTERMEDIATE)")
        void gastronomy_premium() {
            FixedMentor m = resolver.resolve(GoalType.WORK, "Koch / Küche", CurrentLevel.A2, PRO);
            assertThat(m.code()).isEqualTo("KLAUS");
        }

        @Test
        @DisplayName("Gastronomy + FREE → ANNA (KLAUS is INTERMEDIATE, gated)")
        void gastronomy_free_fallsBack() {
            FixedMentor m = resolver.resolve(GoalType.WORK, "Restaurant Küche", CurrentLevel.A2, FREE);
            assertThat(m.code()).isEqualTo("ANNA");
        }

        @Test
        @DisplayName("Business + PRO → EMMA; Business + FREE → ANNA")
        void business() {
            assertThat(resolver.resolve(GoalType.WORK, "Business Development", CurrentLevel.B1, PRO).code())
                    .isEqualTo("EMMA");
            assertThat(resolver.resolve(GoalType.WORK, "kinh doanh", CurrentLevel.B1, FREE).code())
                    .isEqualTo("ANNA");
        }

        @Test
        @DisplayName("Media + PRO → HANNIE")
        void media() {
            assertThat(resolver.resolve(GoalType.WORK, "Medien / Moderator", CurrentLevel.B1, PRO).code())
                    .isEqualTo("HANNIE");
        }

        @Test
        @DisplayName("Unknown / blank industry → ANNA (EDUCATION family default)")
        void unknownIndustry_defaultsToEducation() {
            assertThat(resolver.resolve(GoalType.WORK, "astronaut", CurrentLevel.B1, PRO).code())
                    .isEqualTo("ANNA");
            assertThat(resolver.resolve(GoalType.WORK, null, CurrentLevel.A0, PRO).code())
                    .isEqualTo("ANNA");
        }
    }

    // ── (3)+(4) Tier gate (hard) + level fit (soft tie-break) within a family ──

    @Nested
    @DisplayName("Level fit picks the closest difficulty within a family")
    class LevelFit {

        @Test
        @DisplayName("Healthcare + PRO + B2 → SCHNEIDER (ADVANCED, stable order before WEBER)")
        void healthcare_advanced() {
            FixedMentor m = resolver.resolve(GoalType.WORK, "Dermatologie / Hautarzt", CurrentLevel.B2, PRO);
            assertThat(m.code()).isEqualTo("SCHNEIDER");
            assertThat(m.difficulty()).isEqualTo(MentorDifficulty.ADVANCED);
        }

        @Test
        @DisplayName("Healthcare + PRO + A2 → SARAH (INTERMEDIATE is the level-appropriate fit)")
        void healthcare_intermediate() {
            FixedMentor m = resolver.resolve(GoalType.WORK, "Krankenhaus", CurrentLevel.A2, PRO);
            assertThat(m.code()).isEqualTo("SARAH");
        }

        @Test
        @DisplayName("Healthcare + PRO + A1 → SARAH (no BEGINNER; closest available is INTERMEDIATE)")
        void healthcare_beginnerLevel_picksGentlestAvailable() {
            FixedMentor m = resolver.resolve(GoalType.WORK, "y khoa", CurrentLevel.A1, PRO);
            assertThat(m.code()).isEqualTo("SARAH");
        }

        @Test
        @DisplayName("Healthcare + FREE → ANNA (family has no BEGINNER persona)")
        void healthcare_free_fallsBack() {
            assertThat(resolver.resolve(GoalType.WORK, "Arztpraxis", CurrentLevel.A2, FREE).code())
                    .isEqualTo("ANNA");
        }

        @Test
        @DisplayName("Operations + PRO: A2 → MAX (INTERMEDIATE), B2 → OLIVER (ADVANCED)")
        void operations() {
            assertThat(resolver.resolve(GoalType.WORK, "CNC Maschine", CurrentLevel.A2, PRO).code())
                    .isEqualTo("MAX");
            assertThat(resolver.resolve(GoalType.WORK, "cơ khí", CurrentLevel.B2, PRO).code())
                    .isEqualTo("OLIVER");
        }

        @Test
        @DisplayName("Service + PRO: A0 → NIKLAS (BEGINNER), B1 → NINA (INTERMEDIATE)")
        void service() {
            assertThat(resolver.resolve(GoalType.WORK, "Hotel Rezeption", CurrentLevel.A0, PRO).code())
                    .isEqualTo("NIKLAS");
            assertThat(resolver.resolve(GoalType.WORK, "khách sạn", CurrentLevel.B1, PRO).code())
                    .isEqualTo("NINA");
        }

        @Test
        @DisplayName("Retail + FREE + A1 → LENA (stable order among BEGINNER LENA/PETRA/THOMAS)")
        void retail_free() {
            FixedMentor m = resolver.resolve(GoalType.WORK, "Einzelhandel / Verkauf", CurrentLevel.A1, FREE);
            assertThat(m.code()).isEqualTo("LENA");
            assertThat(m.difficulty()).isEqualTo(MentorDifficulty.BEGINNER);
        }
    }

    // ── Tier resolution ──

    @Nested
    @DisplayName("Plan code → premium gate")
    class TierResolution {

        @ParameterizedTest(name = "{0} is premium")
        @ValueSource(strings = {"PRO", "ULTRA", "PREMIUM", "INTERNAL", "pro", "  ultra  "})
        void premiumCodes(String code) {
            assertThat(resolver.isPremium(code)).isTrue();
        }

        @ParameterizedTest(name = "{0} is not premium")
        @ValueSource(strings = {"FREE", "DEFAULT", "", "  ", "basic", "trial"})
        void nonPremiumCodes(String code) {
            assertThat(resolver.isPremium(code)).isFalse();
        }

        @Test
        @DisplayName("null plan code is treated as free (BEGINNER gate)")
        void nullPlan_isFree() {
            assertThat(resolver.isPremium(null)).isFalse();
            // IT has no BEGINNER → null plan falls back to default
            assertThat(resolver.resolve(GoalType.WORK, "IT", CurrentLevel.B2, null).code()).isEqualTo("ANNA");
        }

        @Test
        @DisplayName("DEFAULT plan (new user, no subscription) gates to BEGINNER")
        void defaultPlan_isFree() {
            assertThat(resolver.resolve(GoalType.WORK, "IT", CurrentLevel.B2, "DEFAULT").code()).isEqualTo("ANNA");
        }
    }

    // ── Null-safety + catalog integrity ──

    @Test
    @DisplayName("null goal is treated as WORK")
    void nullGoal_treatedAsWork() {
        FixedMentor m = resolver.resolve(null, "Software", CurrentLevel.B2, PRO);
        assertThat(m.code()).isEqualTo("LUKAS");
    }

    @Test
    @DisplayName("null currentLevel is treated as A0 (BEGINNER target)")
    void nullLevel_treatedAsA0() {
        // Service + PRO + null level → BEGINNER target → NIKLAS
        FixedMentor m = resolver.resolve(GoalType.WORK, "Hotel", null, PRO);
        assertThat(m.code()).isEqualTo("NIKLAS");
    }

    @ParameterizedTest(name = "{0}/{1}/{2}/{3} → valid SpeakingPersona")
    @MethodSource("representativeInputs")
    @DisplayName("every resolved mentor code is a real SpeakingPersona enum value")
    void resolvedCodeIsValidPersona(GoalType goal, String industry, CurrentLevel level, String plan) {
        FixedMentor m = resolver.resolve(goal, industry, level, plan);
        // Throws IllegalArgumentException if the code is not a SpeakingPersona — guards catalog drift.
        assertThat(SpeakingPersona.valueOf(m.code())).isNotNull();
        assertThat(m.code()).isNotBlank();
        assertThat(m.difficulty()).isNotNull();
        assertThat(m.reason()).isNotBlank();
    }

    private static Stream<Arguments> representativeInputs() {
        return Stream.of(
                Arguments.of(GoalType.CERT, "IT", CurrentLevel.B2, PRO),
                Arguments.of(GoalType.WORK, "IT", CurrentLevel.B2, PRO),
                Arguments.of(GoalType.WORK, "IT", CurrentLevel.A1, FREE),
                Arguments.of(GoalType.WORK, "Healthcare", CurrentLevel.B2, PRO),
                Arguments.of(GoalType.WORK, "Gastronomie", CurrentLevel.A2, PRO),
                Arguments.of(GoalType.WORK, "Verkauf", CurrentLevel.A1, FREE),
                Arguments.of(GoalType.WORK, "Operations CNC", CurrentLevel.B2, PRO),
                Arguments.of(GoalType.WORK, "Hotel Service", CurrentLevel.B1, PRO),
                Arguments.of(GoalType.WORK, "Medien", CurrentLevel.B1, PRO),
                Arguments.of(GoalType.WORK, "Business", CurrentLevel.B1, PRO),
                Arguments.of(GoalType.WORK, null, CurrentLevel.A0, FREE),
                Arguments.of(GoalType.WORK, "etwas Unbekanntes", CurrentLevel.C1, "ULTRA")
        );
    }
}
