package com.deutschflow.user.controller;

import com.deutschflow.common.exception.GlobalExceptionHandler;
import com.deutschflow.unittest.support.MockMvcWithValidation;
import com.deutschflow.user.dto.OnboardingMentorResponse;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.onboarding.OnboardingRoute;
import com.deutschflow.user.onboarding.OnboardingType;
import com.deutschflow.user.onboarding.OnboardingTypeResolver;
import com.deutschflow.user.onboarding.dto.OnboardingContextDtos.AccountSource;
import com.deutschflow.user.onboarding.dto.OnboardingContextDtos.OnboardingContextResponse;
import com.deutschflow.user.onboarding.dto.OnboardingContextDtos.OrgInfo;
import com.deutschflow.user.onboarding.dto.OnboardingContextDtos.TrialInfo;
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
    @Mock com.deutschflow.user.onboarding.service.GuestOnboardingService guestOnboardingService;
    @Mock com.deutschflow.user.onboarding.service.OnboardingActivationService activationService;
    @Mock com.deutschflow.user.onboarding.service.OnboardingContextService contextService;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        var controller = new OnboardingController(
                learningPlanService, learningProfileService, learningProfileRepository, onboardingTypeResolver,
                guestOnboardingService, activationService, contextService);
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
    @DisplayName("GET /context trả cửa vào + trung tâm/lớp + trình độ đặt sẵn + trial (Đợt 5)")
    void context_returnsContext() throws Exception {
        var trialEnd = java.time.Instant.parse("2026-10-31T00:00:00Z");
        when(contextService.contextFor(any())).thenReturn(new OnboardingContextResponse(
                AccountSource.ORG_ROSTER, false,
                new OrgInfo(7L, "Trung tâm Sao Việt", 42L, "B1 tối thứ 3"),
                "A2", new TrialInfo(true, trialEnd)));

        mvc.perform(get("/api/onboarding/context"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountSource").value("ORG_ROSTER"))
                .andExpect(jsonPath("$.hasPlan").value(false))
                .andExpect(jsonPath("$.org.orgId").value(7))
                .andExpect(jsonPath("$.org.name").value("Trung tâm Sao Việt"))
                .andExpect(jsonPath("$.org.classId").value(42))
                .andExpect(jsonPath("$.org.className").value("B1 tối thứ 3"))
                .andExpect(jsonPath("$.presetCurrentLevel").value("A2"))
                .andExpect(jsonPath("$.trial.isTrial").value(true))
                // MockMvc standalone dùng ObjectMapper mặc định (epoch số) ≠ app (ISO) — chỉ kiểm có mặt.
                .andExpect(jsonPath("$.trial.trialEndsAt").exists());
    }

    @Test
    @DisplayName("GET /context của người tự đăng ký: org null, presetCurrentLevel null")
    void context_selfAccount_hasNoOrg() throws Exception {
        when(contextService.contextFor(any())).thenReturn(new OnboardingContextResponse(
                AccountSource.SELF, true, null, null, new TrialInfo(false, null)));

        mvc.perform(get("/api/onboarding/context"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountSource").value("SELF"))
                .andExpect(jsonPath("$.hasPlan").value(true))
                .andExpect(jsonPath("$.org").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.presetCurrentLevel").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.trial.isTrial").value(false));
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

    @Test
    @DisplayName("POST /first-lesson/complete ghi activation theo kind và trả firstTime")
    void firstLessonComplete_returnsActivation() throws Exception {
        java.time.Instant at = java.time.Instant.parse("2026-09-17T13:00:00Z");
        when(activationService.recordFirstLesson(any(Long.class),
                eq(com.deutschflow.user.onboarding.FirstLessonKind.FIRST_SENTENCE)))
                .thenReturn(new com.deutschflow.user.onboarding.dto.ActivationDtos.ActivationResponse(
                        at, true, java.util.List.of("FIRST_LESSON:FIRST_SENTENCE")));

        mvc.perform(post("/api/onboarding/first-lesson/complete")
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"kind\":\"FIRST_SENTENCE\",\"meta\":{\"mode\":\"echo\"}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.firstTime").value(true))
                // MockMvc standalone dùng ObjectMapper mặc định (epoch số) khác app (ISO) — chỉ khẳng định có mốc.
                .andExpect(jsonPath("$.activatedAt").exists())
                .andExpect(jsonPath("$.completedActivities[0]").value("FIRST_LESSON:FIRST_SENTENCE"));
    }

    @Test
    @DisplayName("POST /first-lesson/complete thiếu kind → 400, không ghi gì")
    void firstLessonComplete_missingKind_400() throws Exception {
        mvc.perform(post("/api/onboarding/first-lesson/complete")
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
        org.mockito.Mockito.verifyNoInteractions(activationService);
    }

    @Test
    @DisplayName("POST /progress/core-done trả coreCompletedAt + firstTime")
    void coreDone_returnsResult() throws Exception {
        java.time.Instant at = java.time.Instant.parse("2026-09-17T13:05:00Z");
        when(activationService.recordCoreDone(any(Long.class)))
                .thenReturn(new com.deutschflow.user.onboarding.dto.ActivationDtos.CoreDoneResponse(at, false));

        mvc.perform(post("/api/onboarding/progress/core-done"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.firstTime").value(false))
                .andExpect(jsonPath("$.coreCompletedAt").exists());
    }
}
