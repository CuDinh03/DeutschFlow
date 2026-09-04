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

    /**
     * USD per 1M tokens, split by direction. Output (completion) is usually the costly side.
     *
     * <p>{@code cachedInputPer1M} là giá phần prompt ĐƯỢC CACHE phía nhà cung cấp (Fireworks bật
     * prompt caching tự động — đo thật 09/08: 1150/1151 token hit ngay từ lượt 2). Rẻ hơn input
     * thường 2–10×, nên bỏ qua nó là khai VỐNG COGS của mọi luồng gửi lại system prompt mỗi lượt
     * (chat nói, chấm bài). {@code 0} = nhà cung cấp không cache / chưa tra được giá ⇒ token cache
     * tính như input thường.
     */
    public record ModelRate(double inputPer1M, double outputPer1M, double cachedInputPer1M) {
        /** Model chưa có giá cached-input riêng — cache tính bằng giá input thường. */
        public ModelRate(double inputPer1M, double outputPer1M) {
            this(inputPer1M, outputPer1M, 0.0);
        }

        /** Giá thực tế của 1M token prompt đã cache (rơi về giá input khi chưa có số liệu). */
        public double effectiveCachedInputPer1M() {
            return cachedInputPer1M > 0 ? cachedInputPer1M : inputPer1M;
        }
    }

    /**
     * Fireworks {@code whisper-v3-turbo} — model STT của CẢ HAI tầng (transcript + chấm phát âm)
     * sau khi chuyển nhà cung cấp 09/08/2026: <b>$0.0009/phút audio</b> ⇒ $0.000015/giây.
     *
     * <p>Nguồn: fireworks.ai/blog/audio-transcription-launch (tra lại 09/08/2026 — turbo $0.0009,
     * {@code whisper-v3} thường $0.0015). Hằng số cũ là $0.006/phút (giá OpenAI) nên mọi báo cáo
     * COGS khai vống STT <b>6,7×</b> — đúng vào khoản chi lớn nhất của một phiên nói. Đổi model STT
     * thì phải sửa hằng số này (E.4, checklist khung AI tier).
     */
    public static final double WHISPER_USD_PER_SEC = 0.0009 / 60.0;

    private static final ModelRate LLAMA_4_SCOUT = new ModelRate(0.11, 0.34);
    /** Fireworks {@code gpt-oss-20b} — model NÓI hiện tại: in $0.07 / out $0.30 / cached-in $0.035. */
    private static final ModelRate GPT_OSS_20B    = new ModelRate(0.07, 0.30, 0.035);
    /**
     * Fireworks {@code gpt-oss-120b} (model CHẤM hiện tại) và fallback cho mọi tên gpt/openai khác:
     * in $0.15 / out $0.60 / cached-in $0.015 — cached chỉ 10% giá gốc, rẻ nhất danh mục và đúng
     * hình dạng tầng chấm (system prompt dài, lặp y nguyên qua từng bài).
     */
    private static final ModelRate GPT_MINI       = new ModelRate(0.15, 0.60, 0.015);
    private static final ModelRate EMBEDDING       = new ModelRate(0.02, 0.02);
    private static final ModelRate FREE            = new ModelRate(0.0, 0.0);
    // ── Ứng viên Fireworks của P3/P4/P5 (khung AI tier, quyết định #7–#9 ngày 09/08). Giá Standard
    // tra docs.fireworks.ai/serverless/pricing ngày 09/08/2026 (in / out / cached-in). Slug thật lấy
    // từ GET /inference/v1/models cùng ngày — KHÔNG đoán tên: Fireworks viết "2.6" thành "k2p6",
    // "3.7" thành "3p7", "5.2" thành "5p2", nên nhánh match ở rateFor phải dùng đúng dạng đó.
    /** {@code deepseek-v4-flash} — ứng viên chấm/EXPLAIN (F1) + chốt cho ERROR_VERIFY (quyết định #8). */
    private static final ModelRate DEEPSEEK_V4_FLASH = new ModelRate(0.14, 0.28, 0.028);
    /** {@code deepseek-v4-pro} — ứng viên content/chấm cao cấp. */
    private static final ModelRate DEEPSEEK_V4_PRO   = new ModelRate(1.74, 3.48, 0.145);
    /** {@code qwen3p7-plus} — ứng viên chấm đa ngữ (F1). */
    private static final ModelRate QWEN_37_PLUS      = new ModelRate(0.40, 1.60, 0.08);
    /** {@code minimax-m3} / {@code minimax-m2p7} — ứng viên verify/chấm hạng trung. */
    private static final ModelRate MINIMAX           = new ModelRate(0.30, 1.20, 0.06);
    /** {@code kimi-k2p6} — tầng CONTENT theo quyết định #9 (sinh nội dung bài học, cache 1 lần). */
    private static final ModelRate KIMI_K2_6         = new ModelRate(0.95, 4.00, 0.16);
    /** {@code kimi-k3} — regen toàn cây học tập ở P5 (quyết định #9); đắt nhất danh mục. */
    private static final ModelRate KIMI_K3           = new ModelRate(3.00, 15.00, 0.30);
    /** {@code glm-5p2} — chỉ dùng đối chứng khi so model. */
    private static final ModelRate GLM_5             = new ModelRate(1.40, 4.40, 0.14);
    // ── Rate thêm ở P1 khi kế hoạch còn đi qua OpenRouter. Quyết định owner 09/08 BỎ OpenRouter
    // (Fireworks không serve Anthropic/Google) nên các tầng LLM không còn trỏ tới đây; giữ lại vì
    // Gemini vẫn dùng thật cho OCR và vì ledger cũ còn hàng lịch sử mang những tên model này.
    /** Claude Haiku 4.5 — không còn tầng nào trỏ tới (đường OpenRouter đã đóng 09/08). */
    private static final ModelRate CLAUDE_HAIKU    = new ModelRate(1.00, 5.00);
    /** Claude Sonnet 4.6 — không còn tầng nào trỏ tới (đường OpenRouter đã đóng 09/08). */
    private static final ModelRate CLAUDE_SONNET   = new ModelRate(3.00, 15.00);
    /** Gemini 2.5 Flash — OCR (đang dùng thật; trước đây rơi vào DEFAULT). */
    private static final ModelRate GEMINI_FLASH    = new ModelRate(0.30, 2.50);
    /**
     * Catch-all cho tên model chưa biết. ⚠️ $0.20/$0.20 là "thận trọng" so với đám model rẻ
     * (gpt-oss, llama) nhưng lại khai THIẾU với model frontier — Kimi K3 thật là $3/$15, tức
     * DEFAULT chỉ bằng 1/75 giá output. Vì vậy mọi model mà một tầng THỰC SỰ trỏ tới đều phải có
     * nhánh riêng ở {@link #rateFor(String)}; test khoá điều kiện đó.
     */
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
        if (m.contains("haiku")) {
            // Trước nhánh "claude" chung — Haiku rẻ hơn Sonnet 3×, gộp là khai vống COGS.
            return CLAUDE_HAIKU;
        }
        if (m.contains("claude") || m.contains("sonnet") || m.contains("anthropic")) {
            return CLAUDE_SONNET;
        }
        if (m.contains("gemini")) {
            return GEMINI_FLASH;
        }
        // ── Danh mục Fireworks (slug thật, xem bảng rate ở trên). Đặt TRƯỚC nhánh llama/gpt vì
        // slug Fireworks luôn có tiền tố "accounts/fireworks/models/" — phần đuôi mới là model.
        if (m.contains("deepseek-v4-pro")) {
            return DEEPSEEK_V4_PRO;
        }
        if (m.contains("deepseek-v4-flash")) {
            // Khớp cả bản ghim ngày "deepseek-v4-flash-0731".
            return DEEPSEEK_V4_FLASH;
        }
        if (m.contains("qwen3p7-plus")) {
            return QWEN_37_PLUS;
        }
        if (m.contains("minimax")) {
            return MINIMAX;
        }
        if (m.contains("kimi-k3")) {
            // Trước nhánh k2p6: "kimi-k3-fast" (router) cũng phải về giá K3, không được rơi DEFAULT.
            return KIMI_K3;
        }
        if (m.contains("kimi-k2p6")) {
            // Gồm router "kimi-k2p6-turbo". "kimi-k2p7-code" KHÔNG khớp — chưa tra giá, cứ để DEFAULT.
            return KIMI_K2_6;
        }
        if (m.contains("glm-5")) {
            return GLM_5;
        }
        if (m.contains("scout") || m.contains("llama")) {
            // All Llama family chat models served via Groq share the Scout-class tariff
            // in our deployment; treat generic "llama" the same to avoid under-pricing.
            return LLAMA_4_SCOUT;
        }
        if (m.contains("embedding")) {
            return EMBEDDING;
        }
        if (m.contains("gpt-oss-20b")) {
            // Phải đứng TRƯỚC nhánh "gpt" chung, nếu không 20b bị tính giá gấp đôi thực tế.
            return GPT_OSS_20B;
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

    /**
     * Estimated USD cost for one aggregated bucket of prompt + completion tokens.
     *
     * <p>Không biết phần nào của prompt được cache ⇒ tính TOÀN BỘ prompt theo giá input thường
     * (ước CAO). Chỗ nào đọc được {@code usage.prompt_tokens_details.cached_tokens} thì gọi
     * {@link #costUsd(String, long, long, long)} để ra số sát thực tế hơn.
     */
    public double costUsd(String model, long promptTokens, long completionTokens) {
        return costUsd(model, promptTokens, 0L, completionTokens);
    }

    /**
     * Như trên nhưng tách phần prompt ĐÃ CACHE ra giá riêng — Fireworks cache tự động nên với chat
     * nói (system prompt ~1150 token lặp mỗi lượt) phần cache chiếm gần hết input; tính nhầm nó
     * thành input thường là khai vống chi phí LLM/phiên tới ~3×.
     *
     * @param promptTokens       tổng token prompt (ĐÃ bao gồm phần cache, như API báo)
     * @param cachedPromptTokens phần prompt được cache; ≤0 hoặc &gt; promptTokens ⇒ bỏ qua
     */
    public double costUsd(String model, long promptTokens, long cachedPromptTokens, long completionTokens) {
        ModelRate rate = rateFor(model);
        long cached = (cachedPromptTokens <= 0 || cachedPromptTokens > promptTokens) ? 0L : cachedPromptTokens;
        long fresh = promptTokens - cached;
        return fresh * rate.inputPer1M() / 1_000_000.0
                + cached * rate.effectiveCachedInputPer1M() / 1_000_000.0
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
