package com.deutschflow.marketing.controller;

import com.deutschflow.marketing.dto.GrowthStatsDto;
import com.deutschflow.marketing.dto.MarketingLeadDto;
import com.deutschflow.marketing.dto.TeacherClusterDto;
import com.deutschflow.marketing.service.LeadMagnetService;
import com.deutschflow.marketing.service.TeacherClusterService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Admin xem lead thu từ lead magnet (founder follow-up). Chỉ ADMIN.
 */
@RestController
@RequestMapping("/api/admin/marketing")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminMarketingLeadController {

    private final LeadMagnetService leadMagnetService;
    private final TeacherClusterService teacherClusterService;

    /** GET /api/admin/marketing/stats — số liệu phễu tăng trưởng (lead magnet + report). */
    @GetMapping("/stats")
    public GrowthStatsDto getStats() {
        return leadMagnetService.getGrowthStats();
    }

    /** GET /api/admin/marketing/leads?days=30&limit=200 — lead mới nhất để liên hệ. */
    @GetMapping("/leads")
    public List<MarketingLeadDto> listLeads(
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(defaultValue = "200") int limit) {
        return leadMagnetService.listRecentLeads(days, limit);
    }

    /**
     * GET /api/admin/marketing/teacher-clusters?minSize=3 — centers with ≥minSize non-org teachers
     * (D11 org-sales trigger). Each row = a B2B lead with contact emails for follow-up.
     */
    @GetMapping("/teacher-clusters")
    public List<TeacherClusterDto> teacherClusters(@RequestParam(defaultValue = "3") int minSize) {
        return teacherClusterService.clusters(minSize);
    }
}
