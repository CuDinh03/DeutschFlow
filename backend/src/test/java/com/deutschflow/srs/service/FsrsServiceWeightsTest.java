package com.deutschflow.srs.service;

import com.deutschflow.srs.entity.VocabReviewSchedule;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for per-user weight handling in {@link FsrsService}.
 * Pure unit tests — no Spring context.
 */
class FsrsServiceWeightsTest {

    private final FsrsService fsrsService = new FsrsService();

    private VocabReviewSchedule newCard() {
        return VocabReviewSchedule.builder()
                .userId(1L)
                .vocabId("w1")
                .german("Hallo")
                .meaning("Xin chào")
                .build();
    }

    @Test
    @DisplayName("initializeCard uses the provided per-user weights")
    void initializeCard_usesProvidedWeights() {
        // w[2] is the initial stability for a Good (rating 3) review.
        double[] custom = fsrsService.defaultWeights();
        custom[2] = custom[2] * 2.0;

        VocabReviewSchedule global = newCard();
        fsrsService.initializeCard(global, 3);

        VocabReviewSchedule personalised = newCard();
        fsrsService.initializeCard(personalised, 3, custom);

        assertThat(personalised.getStability().doubleValue())
                .isGreaterThan(global.getStability().doubleValue());
    }

    @Test
    @DisplayName("initializeCard falls back to defaults when weights are the wrong length")
    void initializeCard_invalidLength_fallsBackToDefault() {
        VocabReviewSchedule global = newCard();
        fsrsService.initializeCard(global, 3);

        VocabReviewSchedule bad = newCard();
        fsrsService.initializeCard(bad, 3, new double[]{1.0, 2.0, 3.0}); // wrong length

        assertThat(bad.getStability()).isEqualByComparingTo(global.getStability());
    }

    @Test
    @DisplayName("scheduleReview falls back to defaults when weights contain non-finite values")
    void scheduleReview_nonFinite_fallsBackToDefault() {
        VocabReviewSchedule global = newCard();
        fsrsService.initializeCard(global, 3);
        fsrsService.scheduleReview(global, 3, 1);

        VocabReviewSchedule bad = newCard();
        fsrsService.initializeCard(bad, 3);
        double[] broken = fsrsService.defaultWeights();
        broken[17] = Double.NaN;
        fsrsService.scheduleReview(bad, 3, 1, broken);

        assertThat(bad.getStability()).isEqualByComparingTo(global.getStability());
    }

    @Test
    @DisplayName("defaultWeights returns a 20-element defensive copy")
    void defaultWeights_isDefensiveCopy() {
        double[] a = fsrsService.defaultWeights();
        assertThat(a).hasSize(FsrsService.WEIGHT_COUNT);
        a[0] = 999.0;
        assertThat(fsrsService.defaultWeights()[0]).isNotEqualTo(999.0);
    }
}
