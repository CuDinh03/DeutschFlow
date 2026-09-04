package com.deutschflow.speaking.ai;

/**
 * Token của một lượt gọi LLM.
 *
 * @param promptTokens       tổng token prompt (ĐÃ bao gồm phần được cache, như API báo)
 * @param completionTokens   token sinh ra
 * @param totalTokens        tổng
 * @param estimated          true = tự ước (stream không trả usage), false = số của API
 * @param cachedPromptTokens phần prompt nhà cung cấp phục vụ từ CACHE
 *                           ({@code usage.prompt_tokens_details.cached_tokens}). Fireworks bật
 *                           prompt caching TỰ ĐỘNG và giá token cache chỉ bằng 10–50% giá input
 *                           thường; đo 09/08 thấy hit ~99% ở cả 8 tier (system prompt lặp y nguyên
 *                           mỗi lượt) ⇒ bỏ qua trường này là khai VỐNG chi phí. 0 = không có cache
 *                           hoặc nhà cung cấp không báo.
 */
public record TokenUsage(
        int promptTokens,
        int completionTokens,
        int totalTokens,
        boolean estimated,
        int cachedPromptTokens
) {
    /** Giữ chữ ký 4 tham số cho mọi call site cũ (không có số liệu cache). */
    public TokenUsage(int promptTokens, int completionTokens, int totalTokens, boolean estimated) {
        this(promptTokens, completionTokens, totalTokens, estimated, 0);
    }

    public static TokenUsage exact(int promptTokens, int completionTokens, int totalTokens) {
        return new TokenUsage(promptTokens, completionTokens, totalTokens, false, 0);
    }

    /** Như {@link #exact} nhưng mang theo phần prompt được cache. */
    public static TokenUsage exact(int promptTokens, int completionTokens, int totalTokens,
                                   int cachedPromptTokens) {
        return new TokenUsage(promptTokens, completionTokens, totalTokens, false, cachedPromptTokens);
    }

    public static TokenUsage estimated(int promptTokens, int completionTokens, int totalTokens) {
        return new TokenUsage(promptTokens, completionTokens, totalTokens, true, 0);
    }
}
