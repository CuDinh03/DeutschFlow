package com.deutschflow.marketing.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.user.entity.User;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.marketing.dto.GrowthStatsDto;
import com.deutschflow.marketing.dto.MarketingLeadDto;
import com.deutschflow.marketing.dto.TeacherClusterDto;
import com.deutschflow.marketing.service.LeadMagnetService;
import com.deutschflow.marketing.service.TeacherClusterService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

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
    private final AuditLogService auditLogService;

    /** GET /api/admin/marketing/stats — số liệu phễu tăng trưởng (lead magnet + report). */
    @GetMapping("/stats")
    public GrowthStatsDto getStats() {
        return leadMagnetService.getGrowthStats();
    }

    /** GET /api/admin/marketing/leads?days=30&limit=200 — lead mới nhất để liên hệ. */
    @GetMapping("/leads")
    public List<MarketingLeadDto> listLeads(
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(defaultValue = "200") int limit,
            @AuthenticationPrincipal User actor) {
        List<MarketingLeadDto> leads = leadMagnetService.listRecentLeads(days, limit);
        // Audit F-M3/F-M10 (03/09/2026): danh sách này là email + thông tin liên hệ của người lạ
        // để gọi bán hàng. Đọc nó là một lần truy xuất PII, cần vết như mọi lần truy xuất PII khác.
        auditLogService.log("admin.marketing.leads.read", AuditActor.of(actor),
                "MARKETING_LEAD", null,
                Map.of("days", days, "limit", limit, "returnedCount", leads.size()));
        return leads;
    }

    /**
     * GET /api/admin/marketing/teacher-clusters?minSize=3 — centers with ≥minSize non-org teachers
     * (D11 org-sales trigger). Each row = a B2B lead with contact emails for follow-up.
     */
    @GetMapping("/teacher-clusters")
    public List<TeacherClusterDto> teacherClusters(@RequestParam(defaultValue = "3") int minSize,
                                                   @AuthenticationPrincipal User actor) {
        List<TeacherClusterDto> clusters = teacherClusterService.clusters(minSize);
        // Mỗi hàng là một cụm giáo viên kèm email liên hệ — cùng loại truy xuất PII như /leads.
        auditLogService.log("admin.marketing.teacher_clusters.read",
                AuditActor.of(actor), "MARKETING_LEAD", null,
                Map.of("minSize", minSize, "returnedCount", clusters.size()));
        return clusters;
    }
}
