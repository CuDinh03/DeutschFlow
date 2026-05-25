package com.deutschflow.user.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.deutschflow.user.repository.LearningPlanRepository;
import com.deutschflow.user.repository.LearningSessionStateRepository;
import com.deutschflow.user.repository.LearningSessionAttemptRepository;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class LearningSessionWorkflowServiceUnitTest {
    @Mock com.deutschflow.user.repository.LearningPlanRepository planRepository;
    @Mock com.deutschflow.user.repository.LearningSessionStateRepository sessionStateRepository;
    @Mock com.deutschflow.user.repository.LearningSessionAttemptRepository sessionAttemptRepository;
    @Mock SessionExerciseService sessionExerciseService;
    @Mock StoredLearningPlanSupport storedLearningPlanSupport;
    @Mock LearningSessionProgressService learningSessionProgressService;
    @Mock org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @InjectMocks
    LearningSessionWorkflowService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }
}
