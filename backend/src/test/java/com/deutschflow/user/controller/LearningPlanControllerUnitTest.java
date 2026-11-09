package com.deutschflow.user.controller;

import com.deutschflow.common.exception.GlobalExceptionHandler;
import com.deutschflow.unittest.support.MockMvcWithValidation;
import com.deutschflow.user.dto.SessionCompleteResponse;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.service.LearningPlanService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class LearningPlanControllerUnitTest {

    private MockMvc mvc;
    @Mock
    LearningPlanService learningPlanService;

    @InjectMocks
    LearningPlanController controller;

    private User student;

    @BeforeEach
    void setup() {
        student = User.builder().email("s@test.com").passwordHash("x").displayName("S")
                .role(User.Role.STUDENT).build();
        student.setId(7L);
        mvc = MockMvcWithValidation.standalone(controller, new GlobalExceptionHandler(), student);
    }

    @Test
    void controllerConstructedAndMockMvcInitialized() {
        assertNotNull(controller);
        assertNotNull(mvc);
    }

    /**
     * A2: payload cũ của client (có {@code abilityScore}, {@code timeSeconds = 0}) vẫn 200 — không 400.
     * Chưa có lần nộp đạt thì thân trả {@code completed=false} thay vì lỗi.
     */
    @Test
    void complete_legacyPayloadWithAbilityScore_stillReturns200_withFlag() throws Exception {
        when(learningPlanService.markSessionCompleted(any(User.class), anyInt(), anyInt(), any(), any()))
                .thenReturn(new SessionCompleteResponse(false, "IN_PROGRESS",
                        SessionCompleteResponse.REASON_NO_PASSING_SUBMIT, null, null));

        mvc.perform(post("/api/plan/sessions/complete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"week\":1,\"sessionIndex\":2,\"abilityScore\":0.87,\"timeSeconds\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.completed").value(false))
                .andExpect(jsonPath("$.reason").value("NO_PASSING_SUBMIT"));

        verify(learningPlanService).markSessionCompleted(eq(student), eq(1), eq(2), eq(0.87), eq(0.0));
    }

    @Test
    void complete_negativeTimeSeconds_isNotRejected_serverClamps() throws Exception {
        when(learningPlanService.markSessionCompleted(any(User.class), anyInt(), anyInt(), any(), any()))
                .thenReturn(new SessionCompleteResponse(true, "COMPLETED",
                        SessionCompleteResponse.REASON_COMPLETED, 100, 0.0));

        mvc.perform(post("/api/plan/sessions/complete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"week\":1,\"sessionIndex\":1,\"timeSeconds\":-5}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.completed").value(true));
    }

    @Test
    void complete_missingWeek_isStill400() throws Exception {
        mvc.perform(post("/api/plan/sessions/complete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"sessionIndex\":1}"))
                .andExpect(status().isBadRequest());
    }
}
