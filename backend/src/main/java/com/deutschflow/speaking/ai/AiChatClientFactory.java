package com.deutschflow.speaking.ai;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.util.Locale;

/**
 * Wires the single active {@link OpenAiChatClient} implementation.
 *
 * <p>Default: {@link LocalAiChatClient} ({@code deutschflow_model} via Python server).
 * Set {@code AI_CHAT_PROVIDER=groq} only if chat must fall back to hosted Groq
 * ({@code GROQ_API_KEY} required).
 */
@Configuration
public class AiChatClientFactory {

    @Bean
    @Primary
    public OpenAiChatClient openAiChatClient(
            @Value("${app.ai.chat-provider:local}") String chatProvider,
            LocalAiChatClient localAiChatClient,
            GroqChatClient groqChatClient) {
        String p = chatProvider == null ? "local" : chatProvider.trim().toLowerCase(Locale.ROOT);
        if ("groq".equals(p)) {
            return groqChatClient;
        }
        return localAiChatClient;
    }
}
