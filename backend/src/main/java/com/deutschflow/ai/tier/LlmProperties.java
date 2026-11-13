package com.deutschflow.ai.tier;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Bảng cấu hình khung tier LLM ({@code app.ai.llm.*}) — nguồn sự thật cho "chức năng nào chạy
 * model nào, qua endpoint nào". Xem block cùng tên trong application.yml (có comment từng tier)
 * và {@link LlmTierResolver} (validate + resolve fallback).
 *
 * <p>Style getter/setter theo tiền lệ {@link com.deutschflow.speaking.config.GroqProperties};
 * bản bất biến đưa cho client là {@link TierSpec}.
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "app.ai.llm")
public class LlmProperties {

    /**
     * Endpoint chat-completions dùng chung cho các tier KHÔNG tự khai {@code base-url}.
     * Rỗng ⇒ giữ endpoint mặc định của client (Groq — {@code app.ai.groq.base-url}).
     * Flip cả khung sang OpenRouter = đặt env {@code AI_LLM_BASE_URL}.
     */
    private String baseUrl = "";

    /** API key đi kèm {@link #baseUrl}. Rỗng ⇒ dùng key mặc định của client ({@code GROQ_API_KEY}). */
    private String apiKey = "";

    /**
     * Model dự phòng dùng chung cho mọi tầng (và đường gọi cũ không theo tầng), theo thứ tự ưu tiên —
     * env {@code AI_LLM_FALLBACK_MODELS}, phân cách bằng dấu phẩy. Cùng endpoint/key với model chính.
     * Tầng nào khai {@code fallback-models} riêng thì dùng danh sách riêng. Rỗng = tắt (13/11/2026).
     */
    private List<String> fallbackModels = new java.util.ArrayList<>();

    /** Model vừa lỗi bị bỏ qua bao lâu trước khi thử lại làm model chính (giây). */
    private int failoverCooldownSeconds = 120;

    /** Khoá = {@link LlmTier#configKey()} ({@code chat-free}, {@code grading-exam}, …). */
    private Map<String, Tier> tiers = new HashMap<>();

    /** Cấu hình một tầng — mọi trường trừ {@code model} đều optional. */
    @Getter
    @Setter
    public static class Tier {
        private String model;
        /** Override endpoint riêng tầng này (flip OpenRouter TỪNG tier — F2). */
        private String baseUrl;
        /** Override key riêng tầng này (hiếm khi cần — thường dùng {@code app.ai.llm.api-key}). */
        private String apiKey;
        private List<String> providerOrder;
        private Boolean requireParameters;
        private String sort;
        private List<String> quantizations;
        private String reasoningEffort;
        private boolean sessionSticky = false;
        private boolean includeUsage = false;
        /** Model dự phòng riêng tầng này; null = theo danh sách chung {@code app.ai.llm.fallback-models}. */
        private List<String> fallbackModels;
    }
}
