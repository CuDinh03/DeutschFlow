package com.deutschflow.user.controller;

import com.deutschflow.user.dto.LearningSessionAttemptSummaryDto;
import com.deutschflow.user.dto.LearningPlanResponse;
import com.deutschflow.user.dto.SessionCompleteRequest;
import com.deutschflow.user.dto.SessionDetailResponse;
import com.deutschflow.user.dto.SessionSubmitRequest;
import com.deutschflow.user.dto.SessionSubmitResponse;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.service.LearningPlanService;
import com.deutschflow.user.service.WeakPointGrammarPlanInjector.InjectionResult;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/plan")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class LearningPlanController {

    private final LearningPlanService learningPlanService;

    @GetMapping("/me")
    public LearningPlanResponse me(@AuthenticationPrincipal User user) {
        return learningPlanService.getMyPlan(user);
    }

    @GetMapping("/me/attempts")
    public Page<LearningSessionAttemptSummaryDto> myAttempts(
            @AuthenticationPrincipal User user,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return learningPlanService.listMyAttempts(user, pageable);
    }

    @PostMapping("/me/adaptive-refresh")
    public Map<String, Object> adaptiveRefresh(@AuthenticationPrincipal User user) {
        InjectionResult r = learningPlanService.persistAdaptiveRefresh(user);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("injected", r.injected());
        body.put("reason", r.reason());
        body.put("errorCode", r.errorCode());
        body.put("week", r.week());
        body.put("sessionIndex", r.sessionIndex());
        return body;
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

