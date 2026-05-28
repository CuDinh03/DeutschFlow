package com.deutschflow.assessment.controller;

import com.deutschflow.assessment.dto.B1ReadinessResponse;
import com.deutschflow.assessment.service.B1ReadinessService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/assessment")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class AssessmentController {

    private final B1ReadinessService b1ReadinessService;

    @GetMapping("/b1/readiness")
    public B1ReadinessResponse getReadiness(@AuthenticationPrincipal User user) {
        return b1ReadinessService.getReadiness(user);
    }

    @PostMapping("/b1/evaluate")
    public B1ReadinessResponse evaluate(@AuthenticationPrincipal User user) {
        return b1ReadinessService.evaluate(user);
    }

    @PostMapping("/b1/mock-exam")
    public B1ReadinessResponse recordMockExamResult(@AuthenticationPrincipal User user,
                                                     @RequestParam boolean passed) {
        return b1ReadinessService.recordMockExamResult(user, passed);
    }
}
