package com.deutschflow.marketing.controller;

import com.deutschflow.marketing.dto.MarketingLeadDto;
import com.deutschflow.marketing.service.LeadMagnetService;
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

    /** GET /api/admin/marketing/leads?days=30&limit=200 — lead mới nhất để liên hệ. */
    @GetMapping("/leads")
    public List<MarketingLeadDto> listLeads(
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(defaultValue = "200") int limit) {
        return leadMagnetService.listRecentLeads(days, limit);
    }
}
