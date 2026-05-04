package com.deutschflow.speaking.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.deutschflow.speaking.repository.SpeakingUserStateRepository;
import com.deutschflow.speaking.repository.ErrorReviewTaskRepository;
import com.deutschflow.speaking.repository.UserErrorSkillRepository;
import com.deutschflow.speaking.repository.AiSpeakingSessionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class AdaptivePolicyServiceUnitTest {
    @Mock com.deutschflow.speaking.repository.SpeakingUserStateRepository stateRepository;
    @Mock com.deutschflow.speaking.repository.ErrorReviewTaskRepository taskRepository;
    @Mock com.deutschflow.speaking.repository.UserErrorSkillRepository skillRepository;
    @Mock com.deutschflow.speaking.repository.AiSpeakingSessionRepository sessionRepository;
    @Mock com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    @InjectMocks
    AdaptivePolicyService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }
}
