package com.deutschflow.admin.controller;

import com.deutschflow.admin.dto.AdminRevenueAnalyticsResponse;
import com.deutschflow.admin.service.AdminAnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/analytics")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminAnalyticsController {

    private final AdminAnalyticsService adminAnalyticsService;
    private final com.deutschflow.admin.service.AdminAiUsageService aiUsageService;

    /**
     * AI usage theo feature × model + giây STT + top phiên tốn nhất trong cửa sổ ngày (UTC, ≤92 ngày).
     * {@code featurePrefix} lọc ví dụ {@code EXAM_SPEAKING} (lượt nói, chấm nhanh, chấm mock, STT phòng thi).
     */
    @GetMapping("/ai-usage")
    public com.deutschflow.admin.service.AdminAiUsageService.Report aiUsage(
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate from,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate to,
            @RequestParam(required = false) String featurePrefix) {
        return aiUsageService.report(from, to, featurePrefix);
    }

    @GetMapping("/revenue")
    public ResponseEntity<AdminRevenueAnalyticsResponse> getRevenueAnalytics(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(adminAnalyticsService.getRevenueAnalytics(page, size));
    }
}
