package com.deutschflow.ai.tier;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Khung tier (plans/2026-08-07, khu vực A): resolver là điểm duy nhất quyết định model cho mọi
 * call site LLM — bộ test chốt hợp đồng fail-fast + thứ tự fallback tier → global → client-default.
 */
class LlmTierResolverTest {

    @Test
    @DisplayName("đủ 8 tier: resolver init OK và trả đúng model từng tầng")
    void resolvesAllTiers() {
        LlmProperties props = propsWithAllTiers();
        tier(props, LlmTier.GRADING_EXAM).setModel("openai/gpt-oss-120b");

        LlmTierResolver resolver = new LlmTierResolver(props);
        resolver.init();

        assertThat(resolver.model(LlmTier.GRADING_EXAM)).isEqualTo("openai/gpt-oss-120b");
        assertThat(resolver.spec(LlmTier.CHAT_FREE).tier()).isEqualTo(LlmTier.CHAT_FREE);
    }

    @Test
    @DisplayName("thiếu tier hoặc tier thiếu model: chết ngay lúc khởi động, nêu tên tier thiếu")
    void failsFastWhenTierMissing() {
        LlmProperties props = propsWithAllTiers();
        props.getTiers().remove(LlmTier.CONTENT.configKey());
        tier(props, LlmTier.BATCH).setModel("   ");

        assertThatThrownBy(() -> new LlmTierResolver(props).init())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("content")
                .hasMessageContaining("batch");
    }

    @Test
    @DisplayName("fallback: tier không khai base-url/api-key thì ăn global; khai thì override")
    void fallbackChainForBaseUrlAndKey() {
        LlmProperties props = propsWithAllTiers();
        props.setBaseUrl("https://openrouter.ai/api/v1/chat/completions");
        props.setApiKey("sk-or-global");
        tier(props, LlmTier.CHAT_FREE).setBaseUrl("https://api.groq.com/openai/v1/chat/completions");
        tier(props, LlmTier.CHAT_FREE).setApiKey("gsk-chat");

        LlmTierResolver resolver = new LlmTierResolver(props);
        resolver.init();

        assertThat(resolver.spec(LlmTier.CHAT_FREE).baseUrl())
                .isEqualTo("https://api.groq.com/openai/v1/chat/completions");
        assertThat(resolver.spec(LlmTier.CHAT_FREE).apiKey()).isEqualTo("gsk-chat");
        assertThat(resolver.spec(LlmTier.BATCH).baseUrl())
                .isEqualTo("https://openrouter.ai/api/v1/chat/completions");
        assertThat(resolver.spec(LlmTier.BATCH).apiKey()).isEqualTo("sk-or-global");
    }

    @Test
    @DisplayName("global rỗng (mặc định P1): baseUrl/apiKey của spec là null = client giữ Groq")
    void blankGlobalMeansClientDefaults() {
        LlmTierResolver resolver = new LlmTierResolver(propsWithAllTiers());
        resolver.init();

        assertThat(resolver.spec(LlmTier.GRADING_DAILY).baseUrl()).isNull();
        assertThat(resolver.spec(LlmTier.GRADING_DAILY).apiKey()).isNull();
    }

    @Test
    @DisplayName("provider preferences chỉ 'có' khi thật sự được khai")
    void providerPreferencesDetection() {
        LlmProperties props = propsWithAllTiers();
        tier(props, LlmTier.CHAT_PAID).setProviderOrder(List.of("cerebras"));
        tier(props, LlmTier.CHAT_PAID).setRequireParameters(true);

        LlmTierResolver resolver = new LlmTierResolver(props);
        resolver.init();

        assertThat(resolver.spec(LlmTier.CHAT_PAID).hasProviderPreferences()).isTrue();
        assertThat(resolver.spec(LlmTier.CHAT_FREE).hasProviderPreferences()).isFalse();
    }

    @Test
    @DisplayName("configKey: GRADING_EXAM → grading-exam (khoá yml kebab-case)")
    void configKeyIsKebabCase() {
        assertThat(LlmTier.GRADING_EXAM.configKey()).isEqualTo("grading-exam");
        assertThat(LlmTier.CHAT_FREE.configKey()).isEqualTo("chat-free");
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private static LlmProperties propsWithAllTiers() {
        LlmProperties props = new LlmProperties();
        for (LlmTier tier : LlmTier.values()) {
            LlmProperties.Tier cfg = new LlmProperties.Tier();
            cfg.setModel("openai/gpt-oss-20b");
            props.getTiers().put(tier.configKey(), cfg);
        }
        return props;
    }

    private static LlmProperties.Tier tier(LlmProperties props, LlmTier tier) {
        return props.getTiers().get(tier.configKey());
    }
}
