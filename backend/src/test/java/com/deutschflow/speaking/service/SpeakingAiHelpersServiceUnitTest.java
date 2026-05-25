package com.deutschflow.speaking.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.deutschflow.speaking.ai.OpenAiChatClient;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class SpeakingAiHelpersServiceUnitTest {
    @Mock com.deutschflow.speaking.ai.OpenAiChatClient openAiChatClient;

    @InjectMocks
    SpeakingAiHelpersService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }
}
