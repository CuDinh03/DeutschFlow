package com.deutschflow.user.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.deutschflow.user.repository.LearningSessionProgressRepository;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
class LearningSessionProgressServiceUnitTest {
    @Mock com.deutschflow.user.repository.LearningSessionProgressRepository progressRepository;
    @Mock StoredLearningPlanSupport storedLearningPlanSupport;

    @InjectMocks
    LearningSessionProgressService service;

    @Test
    void serviceConstructedWithMocks() {
        assertNotNull(service);
    }
}
