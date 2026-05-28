package com.deutschflow.assessment.controller;

import com.deutschflow.assessment.dto.B1ReadinessResponse;
import com.deutschflow.assessment.service.B1ReadinessService;
import com.deutschflow.unittest.support.MockMvcWithValidation;
import com.deutschflow.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AssessmentControllerUnitTest {

    private MockMvc mvc;

    @Mock
    private B1ReadinessService b1ReadinessService;

    @InjectMocks
    private AssessmentController controller;

    private final User mockUser = User.builder().id(1L).build();

    private final B1ReadinessResponse sampleResponse = new B1ReadinessResponse(
            true, true, false, false, false, 40, false, null, null);

    @BeforeEach
    void setUp() {
        mvc = MockMvcWithValidation.standalone(controller, null, mockUser);
    }

    @Test
    void getReadiness_returnsOkWithScore() throws Exception {
        when(b1ReadinessService.getReadiness(any())).thenReturn(sampleResponse);

        mvc.perform(get("/api/assessment/b1/readiness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.readinessScore").value(40))
                .andExpect(jsonPath("$.fullyReady").value(false));
    }

    @Test
    void evaluate_returnsOkWithScore() throws Exception {
        when(b1ReadinessService.evaluate(any())).thenReturn(sampleResponse);

        mvc.perform(post("/api/assessment/b1/evaluate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.readinessScore").value(40));
    }

    @Test
    void recordMockExamResult_passed_returnsOk() throws Exception {
        when(b1ReadinessService.recordMockExamResult(any(), eq(true))).thenReturn(sampleResponse);

        mvc.perform(post("/api/assessment/b1/mock-exam").param("passed", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.readinessScore").value(40));
    }
}
