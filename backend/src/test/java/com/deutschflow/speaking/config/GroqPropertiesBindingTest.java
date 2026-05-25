package com.deutschflow.speaking.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit.jupiter.SpringExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;

@ExtendWith(SpringExtension.class)
@EnableConfigurationProperties(GroqProperties.class)
@TestPropertySource(properties = {
        "app.ai.groq.max-concurrent-chat-requests=7",
        "app.ai.groq.max-concurrent-whisper-requests=3",
        "app.ai.groq.semaphore-acquire-timeout-seconds=120"
})
class GroqPropertiesBindingTest {

    @Autowired
    GroqProperties groqProperties;

    @Test
    void bindsGroqConcurrencyFromApplicationProperties() {
        assertEquals(7, groqProperties.getMaxConcurrentChatRequests());
        assertEquals(3, groqProperties.getMaxConcurrentWhisperRequests());
        assertEquals(120, groqProperties.getSemaphoreAcquireTimeoutSeconds());
    }
}
