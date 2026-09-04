package com.deutschflow.common.quota;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

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
    @DisplayName("E.4 — STT theo giá Fireworks whisper-v3-turbo: $0.0009/phút ⇒ 60s = $0.0009")
    void sttPricing_sixtySeconds() {
        assertThat(estimator.costSttUsd(60.0)).isEqualTo(0.0009);
    }

    @Test
    @DisplayName("E.4 — hằng số STT cũ ($0.006/phút, giá OpenAI) khai vống đúng 6,67×")
    void sttPricing_oldConstantWasSixTimesTooHigh() {
        double old = 0.006 / 60.0 * 60.0;
        assertThat(old / estimator.costSttUsd(60.0))
                .isCloseTo(6.67, org.assertj.core.api.Assertions.within(0.01));
    }

    @Test
    @DisplayName("STT pricing: 10s audio costs $0.00015")
    void sttPricing_tenSeconds() {
        assertThat(estimator.costSttUsd(10.0))
                .isCloseTo(0.00015, org.assertj.core.api.Assertions.within(0.0000001));
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

    @Test
    @DisplayName("khung tier P1: model Haiku/Sonnet/Gemini (kể cả tên OpenRouter) KHÔNG rơi vào DEFAULT")
    void tierFrameworkModelsAreNotDefault() {
        var def = estimator.rateFor("some-unknown-model");
        assertThat(estimator.rateFor("anthropic/claude-haiku-4.5")).isNotEqualTo(def);
        assertThat(estimator.rateFor("anthropic/claude-sonnet-4.6")).isNotEqualTo(def);
        assertThat(estimator.rateFor("google/gemini-2.5-flash")).isNotEqualTo(def);
        assertThat(estimator.rateFor("gemini-2.5-flash")).isNotEqualTo(def);
    }

    @Test
    @DisplayName("Haiku đứng trước nhánh claude chung — không bị tính giá Sonnet (chênh 3×)")
    void haikuIsCheaperThanSonnet() {
        double haiku = estimator.costUsd("anthropic/claude-haiku-4.5", 1_000_000, 1_000_000);
        double sonnet = estimator.costUsd("anthropic/claude-sonnet-4.6", 1_000_000, 1_000_000);
        assertThat(haiku).isEqualTo(6.00);   // $1 in + $5 out
        assertThat(sonnet).isEqualTo(18.00); // $3 in + $15 out
    }

    // ── Danh mục Fireworks (slug thật từ GET /inference/v1/models 09/08; giá docs.fireworks.ai) ──

    @Test
    @DisplayName("model đang chạy PROD trên Fireworks có giá đúng, không rơi DEFAULT")
    void fireworksProductionModels() {
        // 1M in + 1M out. 20b: 0.07 + 0.30 · 120b: 0.15 + 0.60.
        assertThat(estimator.costUsd("accounts/fireworks/models/gpt-oss-20b", 1_000_000, 1_000_000))
                .isEqualTo(0.37);
        assertThat(estimator.costUsd("accounts/fireworks/models/gpt-oss-120b", 1_000_000, 1_000_000))
                .isEqualTo(0.75);
    }

    @Test
    @DisplayName("slug 120b KHÔNG khớp nhánh 20b (chuỗi 'gpt-oss-20b' không nằm trong 'gpt-oss-120b')")
    void oneTwentyBIsNotMatchedAsTwentyB() {
        assertThat(estimator.rateFor("accounts/fireworks/models/gpt-oss-120b"))
                .isNotEqualTo(estimator.rateFor("accounts/fireworks/models/gpt-oss-20b"));
    }

    @Test
    @DisplayName("mọi ứng viên P3/P4/P5 đều có giá riêng — DEFAULT khai THIẾU 75× với Kimi K3")
    void fireworksCandidatesAreNotDefault() {
        var def = estimator.rateFor("some-unknown-model");
        for (String slug : List.of(
                "accounts/fireworks/models/deepseek-v4-flash",
                "accounts/fireworks/models/deepseek-v4-flash-0731",
                "accounts/fireworks/models/deepseek-v4-pro",
                "accounts/fireworks/models/qwen3p7-plus",
                "accounts/fireworks/models/kimi-k2p6",
                "accounts/fireworks/routers/kimi-k2p6-turbo",
                "accounts/fireworks/models/kimi-k3",
                "accounts/fireworks/routers/kimi-k3-fast",
                "accounts/fireworks/models/minimax-m3",
                "accounts/fireworks/models/minimax-m2p7",
                "accounts/fireworks/models/glm-5p2")) {
            assertThat(estimator.rateFor(slug)).as(slug).isNotEqualTo(def);
        }
    }

    @Test
    @DisplayName("giá từng ứng viên đúng bảng docs.fireworks.ai (in/out per 1M)")
    void fireworksCandidateRates() {
        assertCostPerMillion("deepseek-v4-flash", 0.42);  // 0.14 + 0.28
        assertCostPerMillion("deepseek-v4-pro", 5.22);    // 1.74 + 3.48
        assertCostPerMillion("qwen3p7-plus", 2.00);       // 0.40 + 1.60
        assertCostPerMillion("kimi-k2p6", 4.95);          // 0.95 + 4.00
        assertCostPerMillion("kimi-k3", 18.00);           // 3.00 + 15.00
        assertCostPerMillion("minimax-m3", 1.50);         // 0.30 + 1.20
        assertCostPerMillion("glm-5p2", 5.80);            // 1.40 + 4.40
    }

    /** 1M token in + 1M token out của một slug Fireworks (dung sai vì cộng số thực). */
    private void assertCostPerMillion(String slug, double expectedUsd) {
        assertThat(estimator.costUsd("accounts/fireworks/models/" + slug, 1_000_000, 1_000_000))
                .as(slug)
                .isCloseTo(expectedUsd, org.assertj.core.api.Assertions.within(0.000001));
    }

    @Test
    @DisplayName("K3 đứng trước K2.6 — 'kimi-k3-fast' không được rơi vào giá K2.6")
    void kimiK3BeforeK2() {
        assertThat(estimator.rateFor("accounts/fireworks/routers/kimi-k3-fast"))
                .isEqualTo(estimator.rateFor("accounts/fireworks/models/kimi-k3"));
        assertThat(estimator.rateFor("accounts/fireworks/models/kimi-k3"))
                .isNotEqualTo(estimator.rateFor("accounts/fireworks/models/kimi-k2p6"));
    }

    @Test
    @DisplayName("v4-pro đứng trước v4-flash — pro đắt 12× ở đầu input, gộp là khai thiếu")
    void deepseekProBeforeFlash() {
        assertThat(estimator.rateFor("accounts/fireworks/models/deepseek-v4-pro").inputPer1M())
                .isEqualTo(1.74);
        assertThat(estimator.rateFor("accounts/fireworks/models/deepseek-v4-flash").inputPer1M())
                .isEqualTo(0.14);
    }

    @Test
    @DisplayName("whisper + embedding của Fireworks giữ nguyên phân loại cũ")
    void fireworksNonChatModels() {
        assertThat(estimator.costUsd("whisper-v3-turbo", 1_000_000, 0)).isZero();
        assertThat(estimator.rateFor("accounts/fireworks/models/qwen3-embedding-8b").inputPer1M())
                .isEqualTo(0.02);
    }

    // ── Prompt caching (Fireworks bật tự động) ──────────────────────────────────────────────

    @Test
    @DisplayName("token prompt ĐÃ CACHE tính giá cached-in: 120b cached chỉ 10% giá input")
    void cachedPromptTokensUseCachedRate() {
        // 1M prompt trong đó 1M được cache ⇒ 1M × $0.015 thay vì 1M × $0.15.
        double cached = estimator.costUsd("accounts/fireworks/models/gpt-oss-120b", 1_000_000, 1_000_000, 0);
        assertThat(cached).isEqualTo(0.015);
        double fresh = estimator.costUsd("accounts/fireworks/models/gpt-oss-120b", 1_000_000, 0, 0);
        assertThat(fresh).isEqualTo(0.15);
    }

    @Test
    @DisplayName("hình dạng thật của 1 lượt chat: 1150/1151 token cache hit ⇒ rẻ hơn cách tính cũ")
    void realChatTurnShapeIsCheaperWithCache() {
        String m = "accounts/fireworks/models/gpt-oss-20b";
        double withCache = estimator.costUsd(m, 1_151, 1_150, 120);
        double withoutCache = estimator.costUsd(m, 1_151, 120);
        assertThat(withCache).isLessThan(withoutCache);
    }

    @Test
    @DisplayName("cached_tokens bất thường (âm, hoặc > prompt) bị bỏ qua — không sinh giá âm")
    void invalidCachedTokenCountsIgnored() {
        String m = "accounts/fireworks/models/gpt-oss-120b";
        double plain = estimator.costUsd(m, 1_000, 500);
        assertThat(estimator.costUsd(m, 1_000, -5, 500)).isEqualTo(plain);
        assertThat(estimator.costUsd(m, 1_000, 9_999, 500)).isEqualTo(plain);
    }

    @Test
    @DisplayName("model chưa có giá cached-in: token cache tính như input thường (không tụt về 0)")
    void modelWithoutCachedRateFallsBackToInputRate() {
        // Llama-4-Scout khai bằng constructor 2 tham số ⇒ cachedInputPer1M = 0 ⇒ dùng giá input.
        double cached = estimator.costUsd("llama-4-scout", 1_000_000, 1_000_000, 0);
        assertThat(cached).isEqualTo(0.11);
    }
}
