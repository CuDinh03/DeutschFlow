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

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/review-tasks")
@RequiredArgsConstructor
public class ReviewTasksController {

    private static final int TODAY_LIMIT = 5;

    private final ReviewSchedulerService reviewSchedulerService;

    @GetMapping("/me/today")
    public List<ErrorReviewTaskDto> today(@AuthenticationPrincipal User user) {
        return reviewSchedulerService.findDueTasks(user.getId(), LocalDateTime.now(), TODAY_LIMIT)
                .stream()
                .map(ReviewTasksController::toDto)
                .toList();
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
}
