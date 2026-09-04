package com.deutschflow.ai.tier;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Bảng tra "tầng → cấu hình model đã resolve" — điểm duy nhất quyết định model cho mọi call site
 * LLM (kế hoạch khu vực A). Service KHÔNG được hardcode chuỗi model hay truyền {@code null}
 * (lịch sử: {@code model=null} rơi ngầm về model nói → 4 luồng chấm chạy nhầm gpt-oss-20b).
 *
 * <p>Fail-fast lúc khởi động khi thiếu tier hoặc tier thiếu model: cấu hình sai phải chết ở
 * deploy, không được sống tới request đầu tiên của user.
 */
@Component
@Slf4j
public class LlmTierResolver {

    private final Map<LlmTier, TierSpec> specs = new EnumMap<>(LlmTier.class);
    private final LlmProperties properties;

    public LlmTierResolver(LlmProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    void init() {
        String globalBaseUrl = blankToNull(properties.getBaseUrl());
        String globalApiKey = blankToNull(properties.getApiKey());
        List<String> missing = new ArrayList<>();

        for (LlmTier tier : LlmTier.values()) {
            LlmProperties.Tier cfg = properties.getTiers().get(tier.configKey());
            if (cfg == null || cfg.getModel() == null || cfg.getModel().isBlank()) {
                missing.add(tier.configKey());
                continue;
            }
            specs.put(tier, new TierSpec(
                    tier,
                    cfg.getModel(),
                    firstNonBlank(cfg.getBaseUrl(), globalBaseUrl),
                    firstNonBlank(cfg.getApiKey(), globalApiKey),
                    cfg.getProviderOrder(),
                    cfg.getRequireParameters(),
                    blankToNull(cfg.getSort()),
                    cfg.getQuantizations(),
                    blankToNull(cfg.getReasoningEffort()),
                    cfg.isSessionSticky(),
                    cfg.isIncludeUsage()));
        }

        if (!missing.isEmpty()) {
            throw new IllegalStateException(
                    "app.ai.llm.tiers thiếu hoặc thiếu model cho: " + missing
                            + " — khai đủ 8 tier trong application.yml (xem plans/2026-08-07-ke-hoach-khung-ai-tier.md)");
        }

        specs.forEach((tier, spec) -> log.info(
                "[LlmTier] {} → model={}{}{}{}",
                tier.configKey(), spec.model(),
                spec.baseUrl() != null ? ", baseUrl=" + spec.baseUrl() : "",
                spec.reasoningEffort() != null ? ", effort=" + spec.reasoningEffort() : "",
                spec.hasProviderPreferences() ? ", provider=" + describeProvider(spec) : ""));
    }

    /** Cấu hình đã resolve của một tầng — không bao giờ null sau khởi động thành công. */
    public TierSpec spec(LlmTier tier) {
        TierSpec spec = specs.get(tier);
        if (spec == null) {
            // Chỉ xảy ra khi gọi trước @PostConstruct (test cấu hình sai) — cùng thông điệp fail-fast.
            throw new IllegalStateException("LlmTierResolver chưa init hoặc thiếu tier: " + tier);
        }
        return spec;
    }

    /** Tiện ích cho nơi chỉ cần chuỗi model (vd {@code GradingModelConfig}). */
    public String model(LlmTier tier) {
        return spec(tier).model();
    }

    private static String describeProvider(TierSpec spec) {
        StringBuilder sb = new StringBuilder("{");
        if (!spec.providerOrder().isEmpty()) sb.append("order=").append(spec.providerOrder());
        if (spec.requireParameters() != null) sb.append(" requireParams=").append(spec.requireParameters());
        if (spec.sort() != null) sb.append(" sort=").append(spec.sort());
        if (!spec.quantizations().isEmpty()) sb.append(" quant=").append(spec.quantizations());
        return sb.append('}').toString();
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private static String firstNonBlank(String a, String b) {
        String first = blankToNull(a);
        return first != null ? first : b;
    }
}
