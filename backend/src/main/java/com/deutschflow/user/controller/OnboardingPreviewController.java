package com.deutschflow.user.controller;

import com.deutschflow.user.dto.OnboardingMentorResponse;
import com.deutschflow.user.service.UserLearningProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public (no-auth) onboarding previews for the value-first funnel, where a guest meets their
 * mentor <b>before</b> creating an account. Deliberately separate from {@link OnboardingController}
 * (which is class-level {@code @PreAuthorize("hasRole('STUDENT')")}); these endpoints are permitted
 * for anonymous access in {@code SecurityConfig} via {@code /api/onboarding/preview/**}.
 *
 * <p>Read-only and non-sensitive — they reveal only which deterministic mentor maps to a set of
 * onboarding selections, assuming the FREE tier. Authoritative assignment still happens at
 * {@code POST /api/onboarding/profile} after signup.
 */
@RestController
@RequestMapping("/api/onboarding/preview")
@RequiredArgsConstructor
public class OnboardingPreviewController {

    private final UserLearningProfileService learningProfileService;

    /** GET /api/onboarding/preview/mentor?goalType=&industry=&currentLevel= — FREE-tier guest preview. */
    @GetMapping("/mentor")
    public OnboardingMentorResponse mentor(
            @RequestParam(value = "goalType", required = false) String goalType,
            @RequestParam(value = "industry", required = false) String industry,
            @RequestParam(value = "currentLevel", required = false) String currentLevel) {
        return learningProfileService.previewMentorForGuest(goalType, industry, currentLevel);
    }
}
