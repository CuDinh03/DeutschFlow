package com.deutschflow.user.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.deutschflow.user.repository.LearningPlanRepository;
import com.deutschflow.user.repository.LearningSessionProgressRepository;
import com.deutschflow.user.repository.LearningSessionAttemptRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class StudentDashboardServiceUnitTest {
    @Mock com.deutschflow.user.repository.LearningPlanRepository planRepository;
    @Mock com.deutschflow.user.repository.LearningSessionProgressRepository progressRepository;
    @Mock com.deutschflow.user.repository.LearningSessionAttemptRepository attemptRepository;
    @Mock com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    @InjectMocks
    StudentDashboardService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }
}
