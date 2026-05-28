package com.deutschflow.user.controller;

import com.deutschflow.user.dto.ErrorAnalyticsDto;
import com.deutschflow.user.dto.LearningAnalyticsSummaryDto;
import com.deutschflow.user.dto.RecommendationDto;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.service.ErrorAnalyticsService;
import com.deutschflow.user.service.LearningAnalyticsService;
import com.deutschflow.user.service.RecommendationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/user")
public class UserAnalyticsController {

    private final LearningAnalyticsService analyticsService;
    private final RecommendationService recommendationService;
    private final ErrorAnalyticsService errorAnalyticsService;

    public UserAnalyticsController(LearningAnalyticsService analyticsService,
                                   RecommendationService recommendationService,
                                   ErrorAnalyticsService errorAnalyticsService) {
        this.analyticsService = analyticsService;
        this.recommendationService = recommendationService;
        this.errorAnalyticsService = errorAnalyticsService;
    }

    @GetMapping("/analytics")
    public ResponseEntity<LearningAnalyticsSummaryDto> getAnalytics(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(analyticsService.getWeeklySummary(user.getId()));
    }

    @GetMapping("/recommendations")
    public ResponseEntity<RecommendationDto> getRecommendations(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(recommendationService.getRecommendations(user.getId()));
    }

    @GetMapping("/error-analytics")
    public ResponseEntity<ErrorAnalyticsDto> getErrorAnalytics(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(errorAnalyticsService.getErrorAnalytics(user.getId()));
    }
}
