package com.deutschflow.ai.tier;

import java.util.List;

/**
 * Cấu hình ĐÃ RESOLVE của một tầng LLM — bất biến, do {@link LlmTierResolver} tạo từ
 * {@code app.ai.llm.*} (tier override → global → mặc định client).
 *
 * <p>{@code baseUrl}/{@code apiKey} = {@code null} nghĩa là "dùng endpoint/key mặc định của
 * client" (hiện là Groq) — nhờ vậy P1 không đổi hành vi nào. Các trường provider/*, sort,
 * quantizations, includeUsage chỉ có nghĩa khi endpoint là OpenRouter; client CHỈ serialize
 * chúng khi được khai, nên request của các tầng chưa flip vẫn byte-for-byte như cũ.
 *
 * @param tier              tầng nguồn
 * @param model             chuỗi model gửi lên API (bắt buộc)
 * @param baseUrl           endpoint chat-completions override; null = mặc định client
 * @param apiKey            API key override (vd OpenRouter); null = key mặc định client
 * @param providerOrder     OpenRouter {@code provider.order} — ghim thứ tự nhà cung cấp
 * @param requireParameters OpenRouter {@code provider.require_parameters} — chỉ route tới
 *                          provider hỗ trợ đủ tham số (JSON mode!)
 * @param sort              OpenRouter {@code provider.sort} (price | throughput | latency)
 * @param quantizations     OpenRouter {@code provider.quantizations} — chặn bản lượng tử hoá thấp
 * @param reasoningEffort   {@code reasoning_effort} cho model reasoning (gpt-oss); null/rỗng = không gửi
 * @param sessionSticky     bật sticky routing theo session (P4 mới dùng)
 * @param includeUsage      xin OpenRouter trả cost thật trong {@code usage} ({@code usage.include})
 */
public record TierSpec(
        LlmTier tier,
        String model,
        String baseUrl,
        String apiKey,
        List<String> providerOrder,
        Boolean requireParameters,
        String sort,
        List<String> quantizations,
        String reasoningEffort,
        boolean sessionSticky,
        boolean includeUsage
) {
    public TierSpec {
        if (model == null || model.isBlank()) {
            throw new IllegalArgumentException("TierSpec." + tier + ": model không được rỗng");
        }
        model = model.trim();
        providerOrder = providerOrder == null ? List.of() : List.copyOf(providerOrder);
        quantizations = quantizations == null ? List.of() : List.copyOf(quantizations);
    }

    /** Tầng này có yêu cầu gì cần serialize vào object {@code provider} của OpenRouter không? */
    public boolean hasProviderPreferences() {
        return !providerOrder.isEmpty()
                || requireParameters != null
                || (sort != null && !sort.isBlank())
                || !quantizations.isEmpty();
    }
}
