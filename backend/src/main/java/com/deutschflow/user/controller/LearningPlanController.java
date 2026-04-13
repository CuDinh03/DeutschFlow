package com.deutschflow.user.controller;

import com.deutschflow.user.dto.LearningPlanResponse;
import com.deutschflow.user.dto.SessionCompleteRequest;
import com.deutschflow.user.dto.SessionDetailResponse;
import com.deutschflow.user.dto.SessionSubmitRequest;
import com.deutschflow.user.dto.SessionSubmitResponse;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.service.LearningPlanService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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

    @GetMapping("/sessions/{week}/{sessionIndex}")
    public SessionDetailResponse session(@AuthenticationPrincipal User user,
                                         @PathVariable int week,
                                         @PathVariable int sessionIndex) {
        return learningPlanService.getSessionDetail(user, week, sessionIndex);
    }

    @PostMapping("/sessions/{week}/{sessionIndex}/theory/viewed")
    public void theoryViewed(@AuthenticationPrincipal User user,
                             @PathVariable int week,
                             @PathVariable int sessionIndex) {
        learningPlanService.markTheoryViewed(user, week, sessionIndex);
    }

    @PostMapping("/sessions/submit")
    public SessionSubmitResponse submit(@AuthenticationPrincipal User user,
                                        @Valid @RequestBody SessionSubmitRequest request) {
        return learningPlanService.submitSession(user, request);
    }

    @PostMapping("/sessions/complete")
    public void complete(@AuthenticationPrincipal User user,
                         @Valid @RequestBody SessionCompleteRequest request) {
        learningPlanService.markSessionCompleted(
                user,
                request.week(),
                request.sessionIndex(),
                request.abilityScore(),
                request.timeSeconds()
        );
    }
}

