package com.deutschflow.gamification.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure tests for the triangular XP-level formula. No Spring, no mocks.
 *
 * <p>The formula is a static math primitive used on every dashboard load, every leaderboard
 * computation, and every level-up check. An off-by-one in either method would silently
 * mis-level every user — exactly the kind of code that benefits most from a parameterised
 * regression test.
 *
 * <p>Boundary values: 100, 300, 600, 1000, 1500, 2100 (triangular × 100).
 */
class XpServiceLevelTest {

    @ParameterizedTest
    @CsvSource({
        "0,    1",   // empty wallet → level 1
        "99,   1",   // just below the level-2 floor
        "100,  2",   // exact floor → next level
        "299,  2",
        "300,  3",
        "599,  3",
        "600,  4",
        "999,  4",
        "1000, 5",
        "1499, 5",
        "1500, 6",
        "2099, 6",
        "2100, 7"
    })
    @DisplayName("computeLevel maps XP to level by the triangular formula")
    void computeLevel(int xp, int expectedLevel) {
        assertThat(XpService.computeLevel(xp)).isEqualTo(expectedLevel);
    }

    @ParameterizedTest
    @CsvSource({
        "1, 0",
        "2, 100",
        "3, 300",
        "4, 600",
        "5, 1000",
        "6, 1500",
        "7, 2100",
        "10, 4500"
    })
    @DisplayName("levelThreshold returns the XP floor for each level")
    void levelThreshold(int level, int expectedXp) {
        assertThat(XpService.levelThreshold(level)).isEqualTo(expectedXp);
    }

    @Test
    @DisplayName("levelThreshold(1) is 0 — level 1 starts at zero XP, not 100")
    void levelThresholdLevel1IsZero() {
        assertThat(XpService.levelThreshold(1)).isZero();
    }

    @Test
    @DisplayName("levelThreshold for levels <= 1 collapses to 0 (defensive)")
    void levelThresholdNonPositiveLevel() {
        assertThat(XpService.levelThreshold(0)).isZero();
        assertThat(XpService.levelThreshold(-5)).isZero();
    }

    @Test
    @DisplayName("computeLevel is capped to prevent the while-loop from spinning on max-int XP")
    void computeLevelCapped() {
        assertThat(XpService.computeLevel(Integer.MAX_VALUE)).isLessThanOrEqualTo(100);
    }

    @Test
    @DisplayName("level boundary is inclusive: XP equal to the threshold awards the next level")
    void thresholdBoundaryIsInclusive() {
        for (int level = 2; level <= 10; level++) {
            int floor = XpService.levelThreshold(level);
            assertThat(XpService.computeLevel(floor))
                    .as("XP exactly at level %d's floor should be level %d", level, level)
                    .isEqualTo(level);
            assertThat(XpService.computeLevel(floor - 1))
                    .as("XP one below level %d's floor should still be level %d", level, level - 1)
                    .isEqualTo(level - 1);
        }
    }
}
