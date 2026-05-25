package com.deutschflow.speaking.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.deutschflow.speaking.repository.UserGrammarErrorRepository;
import com.deutschflow.speaking.repository.UserErrorSkillRepository;
import com.deutschflow.speaking.metrics.SpeakingMetrics;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class ErrorSkillsServiceUnitTest {
    @Mock com.deutschflow.speaking.repository.UserGrammarErrorRepository grammarErrorRepository;
    @Mock com.deutschflow.speaking.repository.UserErrorSkillRepository userErrorSkillRepository;
    @Mock ReviewSchedulerService reviewSchedulerService;
    @Mock com.deutschflow.speaking.metrics.SpeakingMetrics speakingMetrics;
    @Mock AdaptivePolicyService adaptivePolicyService;

    @InjectMocks
    ErrorSkillsService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }
}
