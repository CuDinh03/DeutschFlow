package com.deutschflow.common.quota;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Single source of truth for AI cost estimation across all admin reporting.
 *
 * <p>Replaces the previous blended {@code $0.11/1M} formula, which underestimated
 * Groq Llama-4-Scout by ~43% because it ignored the 3× higher output-token rate.
 * Cost is computed with <b>split input/output pricing</b>: prompt (input) tokens and
 * completion (output) tokens are charged at different rates per the provider's tariff.
 *
 * <p>Pricing lives in code (a reviewable, version-controlled table) rather than in the
 * ledger table: rates change over time and we must never rewrite historical rows. The
 * USD→VND rate is the one value likely to need frequent tuning, so it is externalised
 * to {@code app.ai.cost.usd-vnd-rate}.
 *
 * <p>Rates are USD per 1,000,000 tokens. Sources: Groq + OpenAI public tariffs
 * (captured 2026-06). Unknown models fall back to a deliberately conservative default
 * so planning over-estimates rather than under-estimates COGS.
 */
@Component
public class AiCostEstimator {

    /** USD per 1M tokens, split by direction. Output (completion) is usually the costly side. */
    public record ModelRate(double inputPer1M, double outputPer1M) {}

    /** Groq whisper-large-v3 STT: $0.006/min expressed as a per-second rate. */
    public static final double WHISPER_USD_PER_SEC = 0.006 / 60.0;

    private static final ModelRate LLAMA_4_SCOUT = new ModelRate(0.11, 0.34);
    private static final ModelRate GPT_MINI       = new ModelRate(0.15, 0.60);
    private static final ModelRate EMBEDDING       = new ModelRate(0.02, 0.02);
    private static final ModelRate FREE            = new ModelRate(0.0, 0.0);
    /** Conservative catch-all so an unrecognised model never silently reads as cheap. */
    private static final ModelRate DEFAULT         = new ModelRate(0.20, 0.20);

    private final long usdVndRate;

    public AiCostEstimator(
            @Value("${app.ai.cost.usd-vnd-rate:25400}") long usdVndRate) {
        this.usdVndRate = usdVndRate > 0 ? usdVndRate : 25400L;
    }

    /** Current USD→VND conversion rate used by all cost reports. */
    public long usdVndRate() {
        return usdVndRate;
    }

    /**
     * Resolve the pricing tier for a stored model string. Matching is substring-based
     * and order-sensitive (most specific first) because the ledger stores raw provider
     * model ids such as {@code meta-llama/llama-4-scout-17b-16e-instruct}.
     */
    public ModelRate rateFor(String model) {
        String m = model == null ? "" : model.toLowerCase();
        if (m.isBlank()) {
            return DEFAULT;
        }
        if (m.contains("scout") || m.contains("llama")) {
            // All Llama family chat models served via Groq share the Scout-class tariff
            // in our deployment; treat generic "llama" the same to avoid under-pricing.
            return LLAMA_4_SCOUT;
        }
        if (m.contains("embedding")) {
            return EMBEDDING;
        }
        if (m.contains("gpt") || m.contains("openai")) {
            return GPT_MINI;
        }
        if (m.contains("whisper")) {
            // STT is billed per audio-second, not per token. Token-based cost is ~0;
            // the real STT spend is tracked separately (see AiCostEstimator notes).
            return FREE;
        }
        if (m.contains("deutschflow") || m.contains("local")) {
            // Self-hosted fine-tuned model: marginal per-token cost is ~0 (GPU/infra is
            // a fixed cost captured outside the token ledger).
            return FREE;
        }
        return DEFAULT;
    }

    /** Estimated USD cost for one aggregated bucket of prompt + completion tokens. */
    public double costUsd(String model, long promptTokens, long completionTokens) {
        ModelRate rate = rateFor(model);
        return promptTokens * rate.inputPer1M() / 1_000_000.0
                + completionTokens * rate.outputPer1M() / 1_000_000.0;
    }

    /** Convert a USD cost to VND at the configured rate, rounded to whole đồng. */
    public long toVnd(double usd) {
        return Math.round(usd * usdVndRate);
    }

    /** Round a USD figure to 6 decimal places (sub-cent precision for low-volume buckets). */
    public double roundUsd(double usd) {
        return Math.round(usd * 1_000_000.0) / 1_000_000.0;
    }

    /** Estimated USD cost for a Whisper STT call of the given audio duration. */
    public double costSttUsd(double durationSeconds) {
        return durationSeconds * WHISPER_USD_PER_SEC;
    }

    /**
     * Costs not represented in the token ledger ({@code ai_token_usage_events}), surfaced to
     * admins so the token-derived COGS is never mistaken for the total. Whisper STT is now
     * tracked in {@code stt_usage_events} and is NOT listed here.
     */
    public Map<String, Object> uncoveredCostNotes() {
        Map<String, Object> notes = new LinkedHashMap<>();
        notes.put("edgeTts", "Persona TTS uses self-hosted Edge TTS (free Microsoft voices); no marginal cost.");
        notes.put("localModel", "Self-hosted deutschflow_model token cost counted as $0; GPU/infra is a fixed cost.");
        notes.put("infrastructure", "EC2 + RDS + S3 + Amplify are fixed infra, excluded from this token-derived figure.");
        return notes;
    }
}
