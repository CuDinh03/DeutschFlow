package com.deutschflow.common.quota;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AiCostEstimatorUnitTest {

    private static final long RATE = 25_400L;
    private final AiCostEstimator estimator = new AiCostEstimator(RATE);

    @Test
    @DisplayName("llama-4-scout uses split input/output pricing (0.11 in, 0.34 out)")
    void llamaScoutSplitPricing() {
        // 1M prompt + 1M completion = $0.11 + $0.34 = $0.45
        double cost = estimator.costUsd("meta-llama/llama-4-scout-17b-16e-instruct", 1_000_000, 1_000_000);
        assertThat(cost).isEqualTo(0.45);
    }

    @Test
    @DisplayName("blended formula would underestimate scout output cost — split pricing does not")
    void splitPricingExceedsBlended() {
        // Real session shape: prompt-heavy (2648) + completion (317).
        double split = estimator.costUsd("llama-4-scout", 2_648, 317);
        double blendedOld = (2_648 + 317) * 0.11 / 1_000_000.0; // the previous wrong formula
        assertThat(split).isGreaterThan(blendedOld);
    }

    @Test
    @DisplayName("generic llama model matches the scout-class tariff")
    void genericLlama() {
        assertThat(estimator.rateFor("llama-3.1-8b-instant"))
                .isEqualTo(estimator.rateFor("meta-llama/llama-4-scout-17b-16e-instruct"));
    }

    @Test
    @DisplayName("gpt models use OpenAI mini pricing (0.15 in, 0.60 out)")
    void gptPricing() {
        double cost = estimator.costUsd("gpt-4o-mini", 1_000_000, 1_000_000);
        assertThat(cost).isEqualTo(0.75);
    }

    @Test
    @DisplayName("embedding model uses flat 0.02 pricing")
    void embeddingPricing() {
        double cost = estimator.costUsd("text-embedding-3-small", 1_000_000, 0);
        assertThat(cost).isEqualTo(0.02);
    }

    @Test
    @DisplayName("self-hosted and whisper models are zero marginal token cost")
    void freeModels() {
        assertThat(estimator.costUsd("deutschflow_model", 5_000_000, 5_000_000)).isZero();
        assertThat(estimator.costUsd("whisper-large-v3-turbo", 1_000_000, 0)).isZero();
    }

    @Test
    @DisplayName("STT pricing: $0.006/min → 60s audio costs $0.006")
    void sttPricing_sixtySeconds() {
        assertThat(estimator.costSttUsd(60.0)).isEqualTo(0.006);
    }

    @Test
    @DisplayName("STT pricing: 10s audio costs $0.001")
    void sttPricing_tenSeconds() {
        assertThat(estimator.costSttUsd(10.0))
                .isCloseTo(0.001, org.assertj.core.api.Assertions.within(0.000001));
    }

    @Test
    @DisplayName("STT pricing: zero-duration audio costs nothing")
    void sttPricing_zeroDuration() {
        assertThat(estimator.costSttUsd(0.0)).isZero();
    }

    @Test
    @DisplayName("whisper STT cost is removed from uncoveredCostNotes")
    void sttRemovedFromUncoveredNotes() {
        var notes = estimator.uncoveredCostNotes();
        assertThat(notes).doesNotContainKey("whisperStt");
        assertThat(notes).containsKey("edgeTts");
        assertThat(notes).containsKey("infrastructure");
    }

    @Test
    @DisplayName("unknown / null / blank models fall back to the conservative default rate")
    void unknownFallsBackToDefault() {
        AiCostEstimator.ModelRate def = estimator.rateFor("some-future-model-x");
        assertThat(def.inputPer1M()).isEqualTo(0.20);
        assertThat(def.outputPer1M()).isEqualTo(0.20);
        assertThat(estimator.rateFor(null)).isEqualTo(def);
        assertThat(estimator.rateFor("  ")).isEqualTo(def);
    }

    @Test
    @DisplayName("USD→VND conversion uses the configured rate and rounds to whole đồng")
    void vndConversion() {
        assertThat(estimator.usdVndRate()).isEqualTo(RATE);
        assertThat(estimator.toVnd(1.0)).isEqualTo(25_400L);
        assertThat(estimator.toVnd(0.00260)).isEqualTo(Math.round(0.00260 * RATE)); // ~66 VND/session
    }

    @Test
    @DisplayName("non-positive configured rate falls back to a safe default")
    void invalidRateFallsBack() {
        assertThat(new AiCostEstimator(0).usdVndRate()).isEqualTo(25_400L);
        assertThat(new AiCostEstimator(-5).usdVndRate()).isEqualTo(25_400L);
    }
}
