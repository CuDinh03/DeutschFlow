package com.deutschflow.speaking.ai;

import com.deutschflow.ai.tier.TierSpec;
import com.deutschflow.common.security.support.SupportSessionContextHolder;

import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

/**
 * Bọc client chat {@code @Primary}: mọi lời gọi trên một thread đang trong phiên hỗ trợ chỉ-đọc bị chặn
 * ({@code SupportSessionReadOnlyException} → 403 {@code SUPPORT_SESSION_READ_ONLY}) TRƯỚC khi chạm provider — admin
 * xem như người dùng không được tiêu token AI của ai cả. Ngoài phiên hỗ trợ: chuyển tiếp nguyên vẹn, kể cả các
 * method mặc định mà provider tự override (vd {@code GroqChatClient#chatCompletionForTier}).
 */
public class GuardedOpenAiChatClient implements OpenAiChatClient {

    private final OpenAiChatClient delegate;

    public GuardedOpenAiChatClient(OpenAiChatClient delegate) {
        this.delegate = delegate;
    }

    /** Client thật bên dưới (test / chẩn đoán). */
    public OpenAiChatClient delegate() {
        return delegate;
    }

    private static void guard() {
        SupportSessionContextHolder.assertNotSupportSession("chat");
    }

    @Override
    public AiChatCompletionResult chatCompletion(List<ChatMessage> messages, String model, double temperature,
                                                 Integer maxTokens, boolean forceJson) {
        guard();
        return delegate.chatCompletion(messages, model, temperature, maxTokens, forceJson);
    }

    @Override
    public AiChatCompletionResult chatCompletion(List<ChatMessage> messages, String model, double temperature,
                                                 Integer maxTokens) {
        guard();
        return delegate.chatCompletion(messages, model, temperature, maxTokens);
    }

    @Override
    public boolean chatCompletionStream(List<ChatMessage> messages, String model, double temperature,
                                        Integer maxTokens, Consumer<String> onToken,
                                        Consumer<AiChatCompletionResult> onComplete, AtomicBoolean cancelled) {
        guard();
        return delegate.chatCompletionStream(messages, model, temperature, maxTokens, onToken, onComplete, cancelled);
    }

    @Override
    public AiChatCompletionResult chatCompletionForTier(List<ChatMessage> messages, TierSpec tier,
                                                        double temperature, Integer maxTokens) {
        guard();
        return delegate.chatCompletionForTier(messages, tier, temperature, maxTokens);
    }

    @Override
    public AiChatCompletionResult chatCompletionForTier(List<ChatMessage> messages, TierSpec tier,
                                                        double temperature, Integer maxTokens, boolean forceJson) {
        guard();
        return delegate.chatCompletionForTier(messages, tier, temperature, maxTokens, forceJson);
    }

    @Override
    public boolean chatCompletionStreamForTier(List<ChatMessage> messages, TierSpec tier, double temperature,
                                               Integer maxTokens, Consumer<String> onToken,
                                               Consumer<AiChatCompletionResult> onComplete, AtomicBoolean cancelled) {
        guard();
        return delegate.chatCompletionStreamForTier(messages, tier, temperature, maxTokens, onToken, onComplete,
                cancelled);
    }
}
