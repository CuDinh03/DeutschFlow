package com.deutschflow.user.controller;

import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.user.dto.LearningPlanResponse;
import com.deutschflow.user.dto.LearningProfileResponse;
import com.deutschflow.user.dto.OnboardingProfileRequest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.deutschflow.user.service.LearningPlanService;
import com.deutschflow.user.service.UserLearningProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/onboarding")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class OnboardingController {

    private final LearningPlanService learningPlanService;
    private final UserLearningProfileService learningProfileService;
    private final UserLearningProfileRepository learningProfileRepository;

    @PostMapping("/profile")
    @ResponseStatus(HttpStatus.CREATED)
    public LearningPlanResponse saveProfile(@AuthenticationPrincipal User user,
                                           @Valid @RequestBody OnboardingProfileRequest request) {
        return learningPlanService.saveProfileAndGeneratePlan(user, request);
    }

    @GetMapping("/status")
    public StatusResponse status(@AuthenticationPrincipal User user) {
        return new StatusResponse(learningPlanService.hasPlan(user));
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

    public record StatusResponse(boolean hasPlan) {}
}

