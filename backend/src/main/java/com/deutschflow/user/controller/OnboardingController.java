package com.deutschflow.user.controller;

import com.deutschflow.user.dto.LearningPlanResponse;
import com.deutschflow.user.dto.OnboardingProfileRequest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.service.LearningPlanService;
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

    public record StatusResponse(boolean hasPlan) {}
}

