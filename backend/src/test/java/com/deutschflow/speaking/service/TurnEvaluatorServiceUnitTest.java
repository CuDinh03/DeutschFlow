package com.deutschflow.speaking.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.deutschflow.speaking.repository.SpeakingTurnEvaluationRepository;
import com.deutschflow.speaking.repository.SpeakingUserStateRepository;
import com.deutschflow.speaking.metrics.SpeakingMetrics;
import com.fasterxml.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class TurnEvaluatorServiceUnitTest {
    @Mock com.deutschflow.speaking.repository.SpeakingTurnEvaluationRepository evaluationRepository;
    @Mock com.deutschflow.speaking.repository.SpeakingUserStateRepository stateRepository;
    @Mock com.deutschflow.speaking.metrics.SpeakingMetrics speakingMetrics;
    @Mock AdaptivePolicyService adaptivePolicyService;
    @Mock com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    @InjectMocks
    TurnEvaluatorService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }
}
