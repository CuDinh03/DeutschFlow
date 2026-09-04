package com.deutschflow.speaking.ai;

/**
 * @param costUsd cost THẬT do upstream báo (OpenRouter {@code usage.cost} khi tier bật
 *                {@code include-usage}); {@code null} = upstream không báo → ước theo
 *                {@code AiCostEstimator} như trước. Constructor 4 tham số giữ nguyên cho
 *                mọi call site cũ.
 */
public record AiChatCompletionResult(
        String content,
        TokenUsage usage,
        String provider,
        String model,
        Double costUsd
) {
    public AiChatCompletionResult(String content, TokenUsage usage, String provider, String model) {
        this(content, usage, provider, model, null);
    }
}
