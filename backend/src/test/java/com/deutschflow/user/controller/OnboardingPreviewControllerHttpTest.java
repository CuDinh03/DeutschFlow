package com.deutschflow.user.controller;

import com.deutschflow.common.exception.GlobalExceptionHandler;
import com.deutschflow.unittest.support.MockMvcWithValidation;
import com.deutschflow.user.dto.OnboardingMentorResponse;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.service.UserLearningProfileService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * HTTP-layer tests for the public guest preview ({@code GET /api/onboarding/preview/mentor}),
 * used by the value-first funnel so a guest meets their mentor before signing up. Verifies
 * request binding + JSON shape; the no-auth permit itself is configured in {@code SecurityConfig}.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("OnboardingPreviewController HTTP endpoints")
class OnboardingPreviewControllerHttpTest {

    @Mock UserLearningProfileService learningProfileService;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        var controller = new OnboardingPreviewController(learningProfileService);
        mvc = MockMvcWithValidation.standalone(controller, new GlobalExceptionHandler(), mock(User.class));
    }

    @Test
    @DisplayName("GET /preview/mentor returns the FREE-tier guest mentor + upsell as JSON")
    void previewMentor_returnsMentor() throws Exception {
        when(learningProfileService.previewMentorForGuest(eq("WORK"), eq("IT"), eq("B2")))
                .thenReturn(new OnboardingMentorResponse("ANNA", "Anna", "BEGINNER", "LUKAS", "Lukas"));

        mvc.perform(get("/api/onboarding/preview/mentor")
                        .param("goalType", "WORK").param("industry", "IT").param("currentLevel", "B2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("ANNA"))
                .andExpect(jsonPath("$.displayName").value("Anna"))
                .andExpect(jsonPath("$.difficulty").value("BEGINNER"))
                .andExpect(jsonPath("$.upsellCode").value("LUKAS"))
                .andExpect(jsonPath("$.upsellDisplayName").value("Lukas"));
    }

    @Test
    @DisplayName("GET /preview/mentor works with no params (all optional)")
    void previewMentor_noParams() throws Exception {
        when(learningProfileService.previewMentorForGuest(null, null, null))
                .thenReturn(new OnboardingMentorResponse("ANNA", "Anna", "BEGINNER", null, null));

        mvc.perform(get("/api/onboarding/preview/mentor"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("ANNA"));
    }
}
