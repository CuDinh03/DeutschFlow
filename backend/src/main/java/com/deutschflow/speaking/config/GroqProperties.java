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
     * Fair queue: max seconds to wait for a permit before failing fast with "AI đang bận" (503 +
     * Retry-After). Audit speaking 24/07 (R-B1): 90s cũ vượt xa trần chờ của mọi client
     * (mobile 15–45s, web 8–40s) — client luôn timeout trước còn request thì xếp hàng chết;
     * 10s đảm bảo server bỏ cuộc TRƯỚC client và hàng chờ xả nhanh khi Groq nghẽn.
     */
    private int semaphoreAcquireTimeoutSeconds = 10;
}
