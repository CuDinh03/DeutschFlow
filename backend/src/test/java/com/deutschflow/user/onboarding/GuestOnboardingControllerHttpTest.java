package com.deutschflow.user.onboarding;

import com.deutschflow.common.exception.GlobalExceptionHandler;
import com.deutschflow.unittest.support.MockMvcWithValidation;
import com.deutschflow.user.onboarding.controller.GuestOnboardingController;
import com.deutschflow.user.onboarding.dto.GuestSessionDtos.SessionResponse;
import com.deutschflow.user.onboarding.service.GuestOnboardingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Bề mặt CÔNG KHAI của guest onboarding. Trọng tâm là validation phải từ chối input
 * rác trước khi nó vào cột dùng để tách funnel.
 *
 * <p>Rate-limit KHÔNG kiểm ở đây vì nó nằm ở tầng filter ({@code PublicApiRateLimitFilter}),
 * không phải trong controller — MockMvc standalone không dựng filter chain nên test
 * ở đây chỉ chứng minh được cái mock của chính nó.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class GuestOnboardingControllerHttpTest {

    @Mock private GuestOnboardingService guestOnboardingService;

    private MockMvc mvc;

    private static final UUID SID = UUID.fromString("11111111-2222-3333-4444-555555555555");

    @BeforeEach
    void setUp() {
        var controller = new GuestOnboardingController(guestOnboardingService);
        mvc = MockMvcWithValidation.standalone(controller, new GlobalExceptionHandler(), null);
        when(guestOnboardingService.create(any()))
                .thenReturn(new SessionResponse(SID, "INTRO", "onb_v3", Instant.now().plusSeconds(3600)));
        when(guestOnboardingService.update(any(), any()))
                .thenReturn(new SessionResponse(SID, "PROFILE", "onb_v3", Instant.now().plusSeconds(3600)));
    }

    @Test
    @DisplayName("POST tạo phiên trả 201 kèm sessionId và flowVersion")
    void createReturns201() throws Exception {
        mvc.perform(post("/api/onboarding/guest-session")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"platform\":\"WEB\",\"locale\":\"vi\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sessionId").value(SID.toString()))
                .andExpect(jsonPath("$.flowVersion").value("onb_v3"));
    }

    @Test
    @DisplayName("platform lạ bị từ chối 400 — không để rác vào cột dùng để tách funnel")
    void createRejectsUnknownPlatform() throws Exception {
        mvc.perform(post("/api/onboarding/guest-session")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"platform\":\"WINDOWS_PHONE\",\"locale\":\"vi\"}"))
                .andExpect(status().isBadRequest());
        verify(guestOnboardingService, never()).create(any());
    }

    @Test
    @DisplayName("locale lạ bị từ chối 400")
    void createRejectsUnknownLocale() throws Exception {
        mvc.perform(post("/api/onboarding/guest-session")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"platform\":\"WEB\",\"locale\":\"fr\"}"))
                .andExpect(status().isBadRequest());
        verify(guestOnboardingService, never()).create(any());
    }

    @Test
    @DisplayName("PATCH cập nhật từng phần trả 200")
    void patchReturns200() throws Exception {
        mvc.perform(patch("/api/onboarding/guest-session/" + SID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentStep\":\"PROFILE\",\"answers\":{\"targetLevel\":\"B1\"}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentStep").value("PROFILE"));
    }
}
