package com.deutschflow.speaking.ai;

import java.util.List;

/**
 * HTTP client abstraction for the OpenAI Chat Completions API.
 */
public interface OpenAiChatClient {

    /**
     * Sends a chat completion request to OpenAI and returns the assistant's response text.
     *
     * @param messages    the conversation messages (system prompt first, then history, then user message)
     * @param model       the model to use (e.g., "gpt-4o")
     * @param temperature the sampling temperature (0.0 – 2.0)
     * @return the content of {@code choices[0].message.content}
     * @throws com.deutschflow.speaking.exception.AiServiceException if the API fails after all retries
     */
    String chatCompletion(List<ChatMessage> messages, String model, double temperature);
}
