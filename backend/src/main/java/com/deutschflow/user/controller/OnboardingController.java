package com.deutschflow.user.controller;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.user.dto.LearningPlanResponse;
import com.deutschflow.user.dto.LearningProfileResponse;
import com.deutschflow.user.dto.OnboardingMentorResponse;
import com.deutschflow.user.dto.OnboardingProfileRequest;
import com.deutschflow.user.dto.OnboardingRouteResponse;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.onboarding.dto.GuestSessionDtos.ClaimRequest;
import com.deutschflow.user.onboarding.dto.GuestSessionDtos.ClaimResponse;
import com.deutschflow.user.onboarding.dto.GuestSessionDtos.ProgressResponse;
import com.deutschflow.user.onboarding.service.GuestOnboardingService;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.onboarding.OnboardingRoute;
import com.deutschflow.user.onboarding.OnboardingTypeResolver;
import com.deutschflow.user.onboarding.Platform;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.user.service.LearningPlanService;
import com.deutschflow.user.service.UserLearningProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Locale;

@RestController
@RequestMapping("/api/onboarding")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class OnboardingController {

    private final LearningPlanService learningPlanService;
    private final UserLearningProfileService learningProfileService;
    private final UserLearningProfileRepository learningProfileRepository;
    private final OnboardingTypeResolver onboardingTypeResolver;
    private final GuestOnboardingService guestOnboardingService;

    @PostMapping("/profile")
    @ResponseStatus(HttpStatus.CREATED)
    public LearningPlanResponse saveProfile(@AuthenticationPrincipal User user,
                                           @Valid @RequestBody OnboardingProfileRequest request,
                                           @RequestHeader(value = "X-Platform", required = false) String platform) {
        return learningPlanService.saveProfileAndGeneratePlan(user, request, platform);
    }

    /**
     * GET /api/onboarding/route?currentLevel=&platform=
     * Designated onboarding archetype + post-completion action for the client's
     * (platform, level) cell of the §4 matrix. Platform resolves from the explicit
     * {@code platform} param, then the {@code X-Platform} header, then WEB.
     * The single source of truth for the web and mobile onboarding routers.
     */
    @GetMapping("/route")
    public OnboardingRouteResponse route(
            @RequestParam(value = "currentLevel", required = false) String currentLevel,
            @RequestParam(value = "platform", required = false) String platformParam,
            @RequestHeader(value = "X-Platform", required = false) String platformHeader) {
        Platform platform = Platform.fromText(platformParam != null ? platformParam : platformHeader);
        OnboardingRoute resolved = onboardingTypeResolver.resolve(platform, parseLevel(currentLevel));
        return OnboardingRouteResponse.from(resolved);
    }

    /**
     * GET /api/onboarding/mentor?goalType=&industry=&currentLevel=
     * Live "meet your mentor" preview for the in-progress onboarding selections.
     * Deterministic (same resolver as submit); persists nothing.
     */
    @GetMapping("/mentor")
    public OnboardingMentorResponse mentor(
            @AuthenticationPrincipal User user,
            @RequestParam(value = "goalType", required = false) String goalType,
            @RequestParam(value = "industry", required = false) String industry,
            @RequestParam(value = "currentLevel", required = false) String currentLevel) {
        return learningProfileService.previewMentor(user, goalType, industry, currentLevel);
    }

    @GetMapping("/status")
    public StatusResponse status(@AuthenticationPrincipal User user) {
        return new StatusResponse(learningPlanService.hasPlan(user));
    }

    /**
     * POST /api/onboarding/upsell-interest
     * In-app opt-in to receive PRO-upgrade information by email — the iOS web-upsell
     * handoff (Apple 3.1.1: no in-app pricing/checkout). Idempotent; 204 on success.
     */
    @PostMapping("/upsell-interest")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void upsellInterest(@AuthenticationPrincipal User user) {
        learningProfileService.recordUpsellInterest(user);
    }

    private static UserLearningProfile.CurrentLevel parseLevel(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return UserLearningProfile.CurrentLevel.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /**
     * GET /api/onboarding/me/profile
     * Trả về learning profile đầy đủ dành cho trang Settings pre-fill form.
     */
    @GetMapping("/me/profile")
    public LearningProfileResponse getMyLearningProfile(@AuthenticationPrincipal User user) {
        var profile = learningProfileRepository.findByUserId(user.getId())
                .orElseThrow(() -> new NotFoundException("Learning profile not found. Please complete onboarding first."));
        return learningProfileService.toResponse(profile);
    }

    // ─── Guest session: hai đầu ĐÃ ĐĂNG NHẬP ───────────────────────────────────
    // Hai đầu công khai (tạo/sửa phiên) nằm ở GuestOnboardingController vì class
    // này gắn @PreAuthorize("hasRole('STUDENT')") ở cấp class.

    /**
     * POST /api/onboarding/claim — gắn phiên khách vào tài khoản vừa đăng nhập.
     *
     * <p>Idempotent (spec I-6): gọi lại với cùng phiên trả {@code alreadyClaimed=true},
     * KHÔNG phải lỗi — client retry sau timeout là chuyện bình thường.
     */
    @PostMapping("/claim")
    public ClaimResponse claim(@AuthenticationPrincipal User user,
                               @Valid @RequestBody ClaimRequest request,
                               @RequestHeader(value = "X-Platform", required = false) String platform) {
        return guestOnboardingService.claim(user, request.sessionId(), platform);
    }

    /** GET /api/onboarding/progress — tiến độ server-side, cho resume trên thiết bị khác (spec I-2). */
    @GetMapping("/progress")
    public ProgressResponse progress(@AuthenticationPrincipal User user) {
        return guestOnboardingService.readProgress(user);
    }

    public record StatusResponse(boolean hasPlan) {}
}

