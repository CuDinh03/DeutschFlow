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
import org.junit.jupiter.params.provider.EnumSource;
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
        @DisplayName("IT + PRO + A1 → JONAS (bậc khó khớp trình độ — nay họ IT đã có lựa chọn BEGINNER)")
        void it_premium_beginnerLevel_picksLevelAppropriate() {
            // ĐỔI HÀNH VI có chủ đích (F-15). Tie-break trong resolve() vốn đã chọn
            // persona có bậc gần desiredForLevel nhất; trước đây họ IT chỉ có LUKAS
            // (ADVANCED) nên "gần nhất" luôn là LUKAS bất kể trình độ. Thêm JONAS thì
            // học viên PRO trình A1 nhận đúng người nói tiếng Đức A1-A2 trong ngành
            // mình — chính là điều difficultyForLevel() sinh ra để làm.
            // Chỉ ảnh hưởng lượt gán MỚI (assigned_persona_code đã lưu không đổi), và
            // học viên PRO vẫn tự đổi mentor được trong module Speaking.
            FixedMentor m = resolver.resolve(GoalType.WORK, "Informatik", CurrentLevel.A1, PRO);
            assertThat(m.code()).isEqualTo("JONAS");

            // Lên trình thì vẫn về đúng chuyên gia của ngành.
            assertThat(resolver.resolve(GoalType.WORK, "Informatik", CurrentLevel.B2, PRO).code())
                    .isEqualTo("LUKAS");
        }

        @Test
        @DisplayName("IT + FREE → JONAS (mentor nhập môn của họ IT, không còn rơi về ANNA)")
        void it_free_getsBeginnerItMentor() {
            // Trước F-15: họ IT không có persona BEGINNER nên bộ lọc tier đẩy về ANNA.
            // Đó chính là tiền đề của lỗi mà test cũ vô tình khoá lại.
            FixedMentor m = resolver.resolve(GoalType.WORK, "Software Developer", CurrentLevel.A1, FREE);
            assertThat(m.code()).isEqualTo("JONAS");
            assertThat(m.difficulty()).isEqualTo(MentorDifficulty.BEGINNER);
            assertThat(m.reason()).contains("free");
        }

        @Test
        @DisplayName("Du lịch (Tourismus) + FREE → NIKLAS — mentor ngành mà gói FREE ĐƯỢC dùng (F-6)")
        void tourism_free_reachesServiceBeginner() {
            // Trước bản vá F-6, "Tourismus" không khớp từ khoá nào nên rơi về EDUCATION
            // và trả ANNA — học viên ngành du lịch mất đúng persona BEGINNER mà tier
            // FREE cho phép. Đây là lý do F-6 đáng vá dù chỉ là chuyện từ khoá.
            FixedMentor m = resolver.resolve(GoalType.WORK, "Tourismus", CurrentLevel.A0, FREE);
            assertThat(m.code()).isEqualTo("NIKLAS");
            assertThat(m.difficulty()).isEqualTo(MentorDifficulty.BEGINNER);
        }

        @Test
        @DisplayName("Kỹ thuật (Technik) + PRO → MAX/OLIVER (OPERATIONS), không phải LUKAS (F-6)")
        void technik_premium_isOperationsNotIt() {
            FixedMentor m = resolver.resolve(GoalType.WORK, "Technik", CurrentLevel.A2, PRO);
            assertThat(m.code()).isIn("MAX", "OLIVER");
            assertThat(m.code()).isNotEqualTo("LUKAS");
        }

        @Test
        @DisplayName("Gastronomy + PRO + A2 → KLAUS (INTERMEDIATE)")
        void gastronomy_premium() {
            FixedMentor m = resolver.resolve(GoalType.WORK, "Koch / Küche", CurrentLevel.A2, PRO);
            assertThat(m.code()).isEqualTo("KLAUS");
        }

        @Test
        @DisplayName("Gastronomy + FREE → TIM (KLAUS vẫn khoá ở INTERMEDIATE)")
        void gastronomy_free_getsBeginnerMentor() {
            FixedMentor m = resolver.resolve(GoalType.WORK, "Restaurant Küche", CurrentLevel.A2, FREE);
            assertThat(m.code()).isEqualTo("TIM");
        }

        @Test
        @DisplayName("Business + PRO → EMMA; Business + FREE → FELIX")
        void business() {
            assertThat(resolver.resolve(GoalType.WORK, "Business Development", CurrentLevel.B1, PRO).code())
                    .isEqualTo("EMMA");
            assertThat(resolver.resolve(GoalType.WORK, "kinh doanh", CurrentLevel.B1, FREE).code())
                    .isEqualTo("FELIX");
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

        @Test
        @DisplayName("pathologically long industry is ignored (bounded scan) → default ANNA, not IT")
        void overLongIndustry_ignored() {
            String huge = "IT ".repeat(200); // 600 chars; would match the IT token if scanned
            assertThat(resolver.resolve(GoalType.WORK, huge, CurrentLevel.B2, PRO).code())
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
        @DisplayName("Healthcare + PRO + A1 → MARIE (nay đã có BEGINNER trong họ)")
        void healthcare_beginnerLevel_picksLevelAppropriate() {
            // Cùng lý do như IT + PRO + A1 ở trên.
            assertThat(resolver.resolve(GoalType.WORK, "y khoa", CurrentLevel.A1, PRO).code())
                    .isEqualTo("MARIE");
            // A2 trở lên vẫn là SARAH như cũ.
            assertThat(resolver.resolve(GoalType.WORK, "y khoa", CurrentLevel.A2, PRO).code())
                    .isEqualTo("SARAH");
        }

        @Test
        @DisplayName("Healthcare + FREE → MARIE (SARAH/WEBER/SCHNEIDER vẫn khoá)")
        void healthcare_free_getsBeginnerMentor() {
            assertThat(resolver.resolve(GoalType.WORK, "Arztpraxis", CurrentLevel.A2, FREE).code())
                    .isEqualTo("MARIE");
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
            // Plan null = FREE ⇒ vẫn bị chặn ở bậc BEGINNER, dù học viên đã B2:
            // nhận JONAS (BEGINNER) chứ không phải LUKAS (ADVANCED).
            assertThat(resolver.resolve(GoalType.WORK, "IT", CurrentLevel.B2, null).code()).isEqualTo("JONAS");
        }

        @Test
        @DisplayName("DEFAULT plan (new user, no subscription) gates to BEGINNER")
        void defaultPlan_isFree() {
            assertThat(resolver.resolve(GoalType.WORK, "IT", CurrentLevel.B2, "DEFAULT").code()).isEqualTo("JONAS");
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

    /**
     * F-15 (QA 2026-08-20): tier FREE lọc cứng chỉ còn persona BEGINNER, mà catalog
     * trước đây chỉ có 5 persona BEGINNER trên tổng 9 họ ngành. Hệ quả đo được trên
     * prod: thẻ "Mentor của bạn" ở onboarding trả ANNA cho 5/6 lĩnh vực, ở MỌI cấp
     * độ — người dùng bấm hết các chip mà thẻ không đổi, tưởng app hỏng.
     *
     * <p>Phương án (a) owner chọn: mỗi họ ngành có ít nhất một persona BEGINNER.
     */
    @Nested
    @DisplayName("F-15 — mọi họ ngành đều có mentor cho tài khoản FREE")
    class FreeTierCoverage {

        @DisplayName("mỗi họ ngành có ít nhất một persona BEGINNER trong catalog")
        @ParameterizedTest(name = "{0}")
        @EnumSource(IndustryFamily.class)
        void everyFamilyHasABeginnerPersona(IndustryFamily family) {
            assertThat(FixedMentorResolver.catalogFor(family))
                    .as("họ %s phải có persona BEGINNER, nếu không tài khoản FREE rơi về ANNA", family)
                    .anyMatch(p -> p.difficulty() == MentorDifficulty.BEGINNER);
        }

        @DisplayName("FREE + A0 nhận mentor ĐÚNG NGÀNH, không rơi về ANNA")
        @ParameterizedTest(name = "{0} → {1}")
        @MethodSource("com.deutschflow.user.mentor.FixedMentorResolverTest#freeTierIndustryCases")
        void freeTierGetsIndustryMentor(String industry, IndustryFamily expectedFamily) {
            FixedMentor m = resolver.resolve(GoalType.WORK, industry, CurrentLevel.A0, FREE);

            assertThat(FixedMentorResolver.familyOf(m.code()))
                    .as("industry=%s phải ra mentor họ %s, nhận được %s", industry, expectedFamily, m.code())
                    .isEqualTo(expectedFamily);
            assertThat(m.difficulty()).isEqualTo(MentorDifficulty.BEGINNER);
        }

        @Test
        @DisplayName("6 lựa chọn lĩnh vực của app mobile cho ra 6 mentor KHÁC NHAU (thẻ hết bất động)")
        void mobileIndustryChipsProduceDistinctMentors() {
            String[] chips = { "IT", "Pflege", "Gastronomie", "Verkauf", "Tourismus", "Technik" };

            var codes = java.util.Arrays.stream(chips)
                    .map(i -> resolver.resolve(GoalType.WORK, i, CurrentLevel.A0, FREE).code())
                    .distinct()
                    .toList();

            assertThat(codes).as("mỗi chip phải đổi mentor, không còn 5/6 ra ANNA").hasSize(6);
        }
    }

    static Stream<Arguments> freeTierIndustryCases() {
        return Stream.of(
                Arguments.of("IT", IndustryFamily.IT),
                Arguments.of("Pflege", IndustryFamily.HEALTHCARE),
                Arguments.of("Gastronomie", IndustryFamily.GASTRONOMY),
                Arguments.of("Verkauf", IndustryFamily.RETAIL),
                Arguments.of("Tourismus", IndustryFamily.SERVICE),
                Arguments.of("Technik", IndustryFamily.OPERATIONS),
                Arguments.of("Marketing", IndustryFamily.BUSINESS),
                Arguments.of("Medien", IndustryFamily.MEDIA),
                Arguments.of("Bildung", IndustryFamily.EDUCATION));
    }
}
