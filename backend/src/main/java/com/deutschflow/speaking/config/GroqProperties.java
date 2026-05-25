package com.deutschflow.speaking.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Groq API concurrency and timeouts (chat + Whisper). Active when {@code AI_CHAT_PROVIDER=groq}
 * and/or Whisper STT uses {@link com.deutschflow.speaking.ai.GroqWhisperClient}.
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "app.ai.groq")
public class GroqProperties {

    /**
     * Max simultaneous Groq chat/completions calls (blocking + SSE pump).
     * Free tier ~30 RPM: keep low (3–4). Paid / Dev tier: 5–8 for ~10–20 interview CCU
     * (not every user hits LLM on the same second).
     */
    private int maxConcurrentChatRequests = 5;

    /**
     * Max simultaneous Whisper transcriptions — separate from chat to avoid STT bursts
     * starving chat permits during speaking practice.
     */
    private int maxConcurrentWhisperRequests = 4;

    /**
     * Fair queue: max seconds to wait for a permit before {@code AI service is busy}.
     * Should be &lt; frontend stream stall timeout and SSE emitter timeout.
     */
    private int semaphoreAcquireTimeoutSeconds = 90;
}
