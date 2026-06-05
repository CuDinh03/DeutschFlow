package com.deutschflow.user.service;

import com.deutschflow.user.entity.UserLearningProfile.CurrentLevel;
import com.deutschflow.user.entity.UserLearningProfile.GoalType;
import com.deutschflow.user.entity.UserLearningProfile.TargetLevel;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests {@link LearningPlanService#estimateRequiredHours} — in particular the DI-2 rule that a
 * self-declared (unvalidated) starting level produces a more conservative plan than a
 * placement-validated one.
 */
@DisplayName("LearningPlanService.estimateRequiredHours")
class LearningPlanEstimatorTest {

    @Test
    @DisplayName("A0 start gets no head-start discount, regardless of validation")
    void a0_noDiscount() {
        int validated = LearningPlanService.estimateRequiredHours(CurrentLevel.A0, TargetLevel.B1, GoalType.WORK, true);
        int unvalidated = LearningPlanService.estimateRequiredHours(CurrentLevel.A0, TargetLevel.B1, GoalType.WORK, false);
        assertThat(validated).isEqualTo(280);
        assertThat(unvalidated).isEqualTo(280);
    }

    @Test
    @DisplayName("placement-validated non-A0 level → full 0.7 discount")
    void validatedNonA0_fullDiscount() {
        int hours = LearningPlanService.estimateRequiredHours(CurrentLevel.A2, TargetLevel.B1, GoalType.WORK, true);
        assertThat(hours).isEqualTo(196); // 280 * 0.7
    }

    @Test
    @DisplayName("self-declared non-A0 level → smaller 0.85 discount (more conservative)")
    void unvalidatedNonA0_smallerDiscount() {
        int hours = LearningPlanService.estimateRequiredHours(CurrentLevel.A2, TargetLevel.B1, GoalType.WORK, false);
        assertThat(hours).isEqualTo(238); // 280 * 0.85
    }

    @Test
    @DisplayName("DI-2: an unvalidated level always plans for at least as many hours as a validated one")
    void unvalidatedNeverShorter() {
        for (TargetLevel t : TargetLevel.values()) {
            for (CurrentLevel c : new CurrentLevel[] {CurrentLevel.A1, CurrentLevel.A2, CurrentLevel.B1, CurrentLevel.B2}) {
                int validated = LearningPlanService.estimateRequiredHours(c, t, GoalType.WORK, true);
                int unvalidated = LearningPlanService.estimateRequiredHours(c, t, GoalType.WORK, false);
                assertThat(unvalidated)
                        .as("unvalidated >= validated for %s→%s", c, t)
                        .isGreaterThanOrEqualTo(validated);
            }
        }
    }

    @Test
    @DisplayName("CERT goal adds the 1.1 exam-prep multiplier")
    void cert_bump() {
        int hours = LearningPlanService.estimateRequiredHours(CurrentLevel.A0, TargetLevel.B1, GoalType.CERT, true);
        assertThat(hours).isEqualTo(308); // 280 * 1.1, A0 so no discount
    }
}
