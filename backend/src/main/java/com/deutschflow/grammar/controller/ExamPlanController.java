package com.deutschflow.grammar.controller;

import com.deutschflow.grammar.dto.ExamPlanDto;
import com.deutschflow.grammar.service.ExamPlanService;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.service.UserLearningProfileService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/**
 * Lộ trình đếm ngược tới ngày thi (LT3). Onboarding chỉ hỏi ngày mốc theo tháng, nên ngày thi chính
 * xác được nhập ở đây.
 */
@RestController
@RequestMapping("/api/exam-plan")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class ExamPlanController {

    private final ExamPlanService planService;
    private final UserLearningProfileService profileService;

    public record TargetDateRequest(@NotNull LocalDate targetDate) {}

    @GetMapping
    public ExamPlanDto plan(@AuthenticationPrincipal User user) {
        return planService.planFor(user.getId());
    }

    @PutMapping("/target-date")
    public ExamPlanDto updateTargetDate(@AuthenticationPrincipal User user,
                                        @Valid @RequestBody TargetDateRequest body) {
        profileService.updateTargetDate(user, body.targetDate());
        return planService.planFor(user.getId());
    }
}
