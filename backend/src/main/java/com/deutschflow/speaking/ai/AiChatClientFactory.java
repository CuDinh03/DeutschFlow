package com.deutschflow.speaking.ai;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

/**
 * Wires the single active {@link OpenAiChatClient} implementation.
 *
 * <p>DeutschFlow uses {@link GroqChatClient} (Llama 4 Scout via Groq API).
 * Set {@code GROQ_API_KEY} in your {@code .env} file before starting the backend.
 */
@Configuration
public class AiChatClientFactory {

    @Bean
    @Primary
    public OpenAiChatClient openAiChatClient(GroqChatClient groqChatClient) {
        return groqChatClient;
    }
}
