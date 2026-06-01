package com.deutschflow.speaking.interview;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class LevelCalibratorTest {

    @ParameterizedTest
    @CsvSource({
            "A1, BEGINNER",
            "A2, BEGINNER",
            "B1, INTERMEDIATE",
            "B2, ADVANCED",
            "C1, ADVANCED",
            "C2, ADVANCED",
    })
    @DisplayName("CEFR maps to the expected base difficulty band")
    void cefrMapsToBaseBand(String cefr, QuestionDifficulty expected) {
        assertThat(LevelCalibrator.resolve(cefr, null)).isEqualTo(expected);
    }

    @Test
    @DisplayName("null or unknown CEFR defaults to INTERMEDIATE")
    void unknownCefrDefaultsToIntermediate() {
        assertThat(LevelCalibrator.resolve(null, null)).isEqualTo(QuestionDifficulty.INTERMEDIATE);
        assertThat(LevelCalibrator.resolve("", null)).isEqualTo(QuestionDifficulty.INTERMEDIATE);
        assertThat(LevelCalibrator.resolve("???", null)).isEqualTo(QuestionDifficulty.INTERMEDIATE);
    }

    @Test
    @DisplayName("senior experience raises the band by one")
    void seniorExperienceRaisesBand() {
        // B1 base (INTERMEDIATE) + senior → ADVANCED
        assertThat(LevelCalibrator.resolve("B1", "senior")).isEqualTo(QuestionDifficulty.ADVANCED);
    }

    @Test
    @DisplayName("junior experience lowers the band by one")
    void juniorExperienceLowersBand() {
        // B1 base (INTERMEDIATE) + entry → BEGINNER
        assertThat(LevelCalibrator.resolve("B1", "entry")).isEqualTo(QuestionDifficulty.BEGINNER);
    }

    @Test
    @DisplayName("experience adjustment is clamped at the band boundaries")
    void experienceAdjustmentClamps() {
        // A2 base (BEGINNER) + junior cannot go below BEGINNER
        assertThat(LevelCalibrator.resolve("A2", "junior")).isEqualTo(QuestionDifficulty.BEGINNER);
        // C1 base (ADVANCED) + senior cannot exceed ADVANCED
        assertThat(LevelCalibrator.resolve("C1", "senior")).isEqualTo(QuestionDifficulty.ADVANCED);
    }

    @Test
    @DisplayName("neutral experience leaves the CEFR base band unchanged")
    void neutralExperienceKeepsBase() {
        assertThat(LevelCalibrator.resolve("B1", "1-2Y")).isEqualTo(QuestionDifficulty.INTERMEDIATE);
    }
}
