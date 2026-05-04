package com.deutschflow.speaking.controller;

import com.deutschflow.unittest.support.MockMvcWithValidation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.deutschflow.speaking.service.AdaptivePolicyService;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.user.service.StudentDashboardService;
import com.fasterxml.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
class TodayControllerUnitTest {

    private MockMvc mvc;
    @Mock
    com.deutschflow.speaking.service.AdaptivePolicyService adaptivePolicyService;
    @Mock
    com.deutschflow.user.repository.UserLearningProfileRepository profileRepository;
    @Mock
    com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    @Mock
    com.deutschflow.user.service.StudentDashboardService studentDashboardService;

    @InjectMocks
    TodayController controller;

    @BeforeEach
    void setup() {
        mvc = MockMvcWithValidation.standaloneWithAdvice(controller);
    }

    @Test
    void controllerConstructedAndMockMvcInitialized() {
        assertNotNull(controller);
        assertNotNull(mvc);
    }
}
