package com.deutschflow.user.controller;

import com.deutschflow.user.dto.LearningPlanResponse;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.service.LearningPlanService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/plan")
@RequiredArgsConstructor
public class LearningPlanController {

    private final LearningPlanService learningPlanService;

    @GetMapping("/me")
    public LearningPlanResponse me(@AuthenticationPrincipal User user) {
        return learningPlanService.getMyPlan(user);
    }
}

