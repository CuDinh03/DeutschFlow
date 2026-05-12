package com.deutschflow.speaking.controller;

import com.deutschflow.speaking.dto.CompleteReviewTaskRequest;
import com.deutschflow.speaking.dto.ErrorReviewTaskDto;
import com.deutschflow.speaking.entity.ErrorReviewTask;
import com.deutschflow.speaking.service.ReviewSchedulerService;
import com.deutschflow.user.entity.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import com.deutschflow.common.quota.QuotaService;

@RestController
@RequestMapping("/api/review-tasks")
@RequiredArgsConstructor
public class ReviewTasksController {

    private static final int TODAY_LIMIT = 5;

    private final ReviewSchedulerService reviewSchedulerService;
    private final QuotaService quotaService;

    @GetMapping("/me/today")
    public ReviewTasksResponse today(@AuthenticationPrincipal User user) {
        List<ErrorReviewTask> dueTasks = reviewSchedulerService.findDueTasks(user.getId(), LocalDateTime.now(), TODAY_LIMIT);
        
        com.deutschflow.common.quota.PlanBadge badge = quotaService.resolvePlanBadge(user.getId(), Instant.now());
        boolean isProOrBetter = "PRO".equals(badge.planCode()) || "ULTRA".equals(badge.planCode()) || "INTERNAL".equals(badge.planCode());
        
        int lockedCount = 0;
        if (!isProOrBetter && dueTasks.size() > 2) {
            lockedCount = dueTasks.size() - 2;
            dueTasks = dueTasks.subList(0, 2);
        }
        
        List<ErrorReviewTaskDto> dtoList = dueTasks.stream()
                .map(ReviewTasksController::toDto)
                .toList();
                
        return new ReviewTasksResponse(dtoList, lockedCount);
    }

    @PostMapping("/{taskId}/complete")
    public ResponseEntity<Void> complete(
            @AuthenticationPrincipal User user,
            @PathVariable Long taskId,
            @Valid @RequestBody CompleteReviewTaskRequest body) {
        reviewSchedulerService.completeTask(user.getId(), taskId, Boolean.TRUE.equals(body.passed()));
        return ResponseEntity.noContent().build();
    }

    private static ErrorReviewTaskDto toDto(ErrorReviewTask t) {
        return new ErrorReviewTaskDto(
                t.getId(),
                t.getErrorCode(),
                t.getTaskType(),
                t.getDueAt(),
                t.getIntervalDays());
    }

    public record ReviewTasksResponse(List<ErrorReviewTaskDto> tasks, int lockedCount) {}
}
