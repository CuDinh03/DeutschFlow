package com.deutschflow.user.controller;

import com.deutschflow.common.exception.GlobalExceptionHandler;
import com.deutschflow.unittest.support.MockMvcWithValidation;
import com.deutschflow.user.dto.OnboardingMentorResponse;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.onboarding.OnboardingRoute;
import com.deutschflow.user.onboarding.OnboardingType;
import com.deutschflow.user.onboarding.OnboardingTypeResolver;
import com.deutschflow.user.onboarding.PostOnboardingAction;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.user.service.LearningPlanService;
import com.deutschflow.user.service.UserLearningProfileService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * HTTP-layer tests for the new onboarding endpoints ({@code /route}, {@code /mentor},
 * {@code /upsell-interest}) — verifies request binding, status codes, and JSON shape.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("OnboardingController HTTP endpoints")
class OnboardingControllerHttpTest {

    @Mock LearningPlanService learningPlanService;
    @Mock UserLearningProfileService learningProfileService;
    @Mock UserLearningProfileRepository learningProfileRepository;
    @Mock OnboardingTypeResolver onboardingTypeResolver;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        var controller = new OnboardingController(
                learningPlanService, learningProfileService, learningProfileRepository, onboardingTypeResolver);
        mvc = MockMvcWithValidation.standalone(controller, new GlobalExceptionHandler(), mock(User.class));
    }

    @Test
    @DisplayName("GET /route returns the resolved routing decision as JSON")
    void route_returnsRoute() throws Exception {
        // Value-first web A1: placement is no longer gating, only an optional shortcut.
        when(onboardingTypeResolver.resolve(any(), any())).thenReturn(new OnboardingRoute(
                OnboardingType.PLACEMENT_VALIDATED, false, true, true, true, PostOnboardingAction.ROADMAP_NODE));

        mvc.perform(get("/api/onboarding/route").param("currentLevel", "A1").param("platform", "web"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.onboardingType").value("PLACEMENT_VALIDATED"))
                .andExpect(jsonPath("$.placementRequired").value(false))
                .andExpect(jsonPath("$.placementOptional").value(true))
                .andExpect(jsonPath("$.assessmentHookAfter").value(true))
                .andExpect(jsonPath("$.paywallAllowed").value(true))
                .andExpect(jsonPath("$.postAction").value("ROADMAP_NODE"));
    }

    @Test
    @DisplayName("GET /mentor returns the assigned mentor + upsell as JSON")
    void mentor_returnsMentor() throws Exception {
        when(learningProfileService.previewMentor(any(), eq("WORK"), eq("IT"), eq("B2")))
                .thenReturn(new OnboardingMentorResponse("ANNA", "Anna", "BEGINNER", "LUKAS", "Lukas"));

        mvc.perform(get("/api/onboarding/mentor")
                        .param("goalType", "WORK").param("industry", "IT").param("currentLevel", "B2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("ANNA"))
                .andExpect(jsonPath("$.displayName").value("Anna"))
                .andExpect(jsonPath("$.upsellCode").value("LUKAS"))
                .andExpect(jsonPath("$.upsellDisplayName").value("Lukas"));
    }

    @Test
    @DisplayName("POST /upsell-interest records consent and returns 204")
    void upsellInterest_returns204() throws Exception {
        mvc.perform(post("/api/onboarding/upsell-interest"))
                .andExpect(status().isNoContent());
        verify(learningProfileService).recordUpsellInterest(any());
    }
}
