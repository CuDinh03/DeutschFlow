package com.deutschflow.speaking.ai;

import java.util.List;
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
     * @return content of {@code choices[0].message.content}
     * @throws com.deutschflow.speaking.exception.AiServiceException if the API fails after all retries
     */
    String chatCompletion(List<ChatMessage> messages, String model, double temperature);

    /**
     * Sends a streaming chat completion request.
     * Tokens are delivered to {@code onToken} as they arrive; {@code onComplete} is called when done.
     *
     * @param messages    conversation messages
     * @param model       model override (null = use configured default)
     * @param temperature sampling temperature
     * @param onToken     called for each incremental content delta
     * @param onComplete  called once when the stream is fully consumed (from caller's thread)
     */
    void chatCompletionStream(List<ChatMessage> messages, String model, double temperature,
                              Consumer<String> onToken, Runnable onComplete);
}
