package com.deutschflow.speaking.ai;

import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

/**
 * HTTP client abstraction for the OpenAI-compatible Chat Completions API.
 */
public interface OpenAiChatClient {

    /**
     * Sends a blocking chat completion request and returns the assistant's full response text.
     *
     * @param messages    conversation messages (system first, then history, then user)
     * @param model       model override (null = use configured default)
     * @param temperature sampling temperature (0.0 – 2.0)
     * @param maxTokens   max completion tokens (null = client default)
     * @return content + usage
     * @throws com.deutschflow.speaking.exception.AiServiceException if the API fails after all retries
     */
    AiChatCompletionResult chatCompletion(List<ChatMessage> messages, String model, double temperature, Integer maxTokens);

    /**
     * Sends a streaming chat completion request.
     * Tokens are delivered to {@code onToken} as they arrive; {@code onComplete} is called when done.
     *
     * @param messages    conversation messages
     * @param model       model override (null = use configured default)
     * @param temperature sampling temperature
     * @param maxTokens   max completion tokens (null = client default)
     * @param onToken     called for each incremental content delta
     * @param onComplete  called once when the stream is fully consumed (from caller's thread)
     * @param cancelled   when non-null and set to {@code true}, abort streaming
     *                    and return {@code false} without invoking {@code onComplete}
     * @return {@code true} if the stream finished normally and {@code onComplete} ran;
     *         {@code false} if aborted due to {@code cancelled}
     */
    boolean chatCompletionStream(List<ChatMessage> messages, String model, double temperature,
                                 Integer maxTokens, Consumer<String> onToken,
                                 Consumer<AiChatCompletionResult> onComplete,
                                 AtomicBoolean cancelled);

    // ── Đường gọi theo TẦNG (khung tier, plans/2026-08-07) ─────────────────────────────────────

    /**
     * Blocking completion theo {@link com.deutschflow.ai.tier.TierSpec} — call site khai tầng,
     * KHÔNG khai model. Default: chỉ lấy model của tier (đủ cho {@code LocalAiChatClient});
     * {@code GroqChatClient} override để áp cả endpoint/provider/reasoning-effort của tier.
     */
    default AiChatCompletionResult chatCompletionForTier(List<ChatMessage> messages,
                                                  com.deutschflow.ai.tier.TierSpec tier,
                                                  double temperature, Integer maxTokens) {
        return chatCompletion(messages, tier == null ? null : tier.model(), temperature, maxTokens);
    }

    /** Bản stream của đường gọi theo tầng — cùng quy ước với overload blocking ở trên. */
    default boolean chatCompletionStreamForTier(List<ChatMessage> messages,
                                         com.deutschflow.ai.tier.TierSpec tier,
                                         double temperature, Integer maxTokens,
                                         Consumer<String> onToken,
                                         Consumer<AiChatCompletionResult> onComplete,
                                         AtomicBoolean cancelled) {
        return chatCompletionStream(messages, tier == null ? null : tier.model(), temperature,
                maxTokens, onToken, onComplete, cancelled);
    }
}
