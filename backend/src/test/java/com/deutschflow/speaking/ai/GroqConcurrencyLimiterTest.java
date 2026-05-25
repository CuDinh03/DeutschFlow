package com.deutschflow.speaking.ai;

import com.deutschflow.speaking.config.GroqProperties;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GroqConcurrencyLimiterTest {

    @Test
    void chatPermitsMatchConfiguration() throws InterruptedException {
        GroqProperties props = new GroqProperties();
        props.setMaxConcurrentChatRequests(2);
        props.setMaxConcurrentWhisperRequests(1);
        props.setSemaphoreAcquireTimeoutSeconds(1);

        GroqConcurrencyLimiter limiter = new GroqConcurrencyLimiter(props);
        assertEquals(2, limiter.availableChatPermits());

        assertTrue(limiter.tryAcquireChat());
        assertTrue(limiter.tryAcquireChat());
        assertEquals(0, limiter.availableChatPermits());
        assertFalse(limiter.tryAcquireChat());

        limiter.releaseChat();
        limiter.releaseChat();
        assertEquals(2, limiter.availableChatPermits());
    }

    @Test
    void whisperPermitsAreIndependentFromChat() throws InterruptedException {
        GroqProperties props = new GroqProperties();
        props.setMaxConcurrentChatRequests(1);
        props.setMaxConcurrentWhisperRequests(2);
        props.setSemaphoreAcquireTimeoutSeconds(1);

        GroqConcurrencyLimiter limiter = new GroqConcurrencyLimiter(props);
        assertTrue(limiter.tryAcquireWhisper());
        assertTrue(limiter.tryAcquireWhisper());
        assertFalse(limiter.tryAcquireWhisper());
        limiter.releaseWhisper();
        limiter.releaseWhisper();
        assertEquals(2, limiter.availableWhisperPermits());
    }
}
