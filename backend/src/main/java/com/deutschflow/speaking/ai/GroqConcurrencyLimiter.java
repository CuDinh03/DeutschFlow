package com.deutschflow.speaking.ai;

import com.deutschflow.speaking.config.GroqProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

/**
 * Process-wide fair queuing for Groq chat and Whisper. Limits burst traffic against account RPM/TPM.
 */
@Component
@Slf4j
public class GroqConcurrencyLimiter {

    private final Semaphore chatSemaphore;
    private final Semaphore whisperSemaphore;
    private final long acquireTimeoutSeconds;

    public GroqConcurrencyLimiter(GroqProperties properties) {
        int chatPermits = Math.max(1, properties.getMaxConcurrentChatRequests());
        int whisperPermits = Math.max(1, properties.getMaxConcurrentWhisperRequests());
        this.acquireTimeoutSeconds = Math.max(1, properties.getSemaphoreAcquireTimeoutSeconds());
        this.chatSemaphore = new Semaphore(chatPermits, true);
        this.whisperSemaphore = new Semaphore(whisperPermits, true);
        log.info("[Groq] Concurrency — chat permits={}, whisper permits={}, acquire timeout={}s",
                chatPermits, whisperPermits, acquireTimeoutSeconds);
    }

    public boolean tryAcquireChat() throws InterruptedException {
        return chatSemaphore.tryAcquire(acquireTimeoutSeconds, TimeUnit.SECONDS);
    }

    public void releaseChat() {
        chatSemaphore.release();
    }

    public boolean tryAcquireWhisper() throws InterruptedException {
        return whisperSemaphore.tryAcquire(acquireTimeoutSeconds, TimeUnit.SECONDS);
    }

    public void releaseWhisper() {
        whisperSemaphore.release();
    }

    /** Visible for unit tests. */
    int availableChatPermits() {
        return chatSemaphore.availablePermits();
    }

    int availableWhisperPermits() {
        return whisperSemaphore.availablePermits();
    }
}
