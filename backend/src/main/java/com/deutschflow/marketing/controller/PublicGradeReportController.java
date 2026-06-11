package com.deutschflow.marketing.controller;

import com.deutschflow.marketing.dto.GradeReportDto;
import com.deutschflow.marketing.service.LeadMagnetService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Báo cáo chấm công khai (xem qua share token) — vòng lặp PLG D6, chia sẻ qua Zalo.
 * Nằm dưới {@code /api/public/**} (đã permitAll). Không lộ PII (chỉ điểm + nhận xét + chủ đề).
 */
@RestController
@RequestMapping("/api/public/grade-report")
@RequiredArgsConstructor
public class PublicGradeReportController {

    private final LeadMagnetService leadMagnetService;

    @GetMapping("/{token}")
    public GradeReportDto getReport(@PathVariable String token) {
        return leadMagnetService.getReport(token);
    }
}
