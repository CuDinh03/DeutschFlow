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
    }
}
