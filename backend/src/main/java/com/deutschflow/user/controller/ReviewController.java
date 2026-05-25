package com.deutschflow.user.controller;

import com.deutschflow.user.dto.ReviewDueResponse;
import com.deutschflow.user.dto.ReviewGradeRequest;
import com.deutschflow.user.dto.ReviewGradeResponse;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.service.ReviewQueueService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class ReviewController {

    private final ReviewQueueService reviewQueueService;

    @GetMapping("/due")
    public ReviewDueResponse due(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "20") Integer limit,
            @RequestParam(required = false) String type
    ) {
        return reviewQueueService.dueItems(user, limit, type);
    }

    @PostMapping("/{reviewId}/grade")
    public ReviewGradeResponse grade(
            @AuthenticationPrincipal User user,
            @PathVariable long reviewId,
            @Valid @RequestBody ReviewGradeRequest request
    ) {
        return reviewQueueService.grade(user, reviewId, request.quality());
    }
}
