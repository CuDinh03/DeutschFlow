package com.deutschflow.moderation.controller;

import com.deutschflow.moderation.dto.ModerationDtos.ReportDto;
import com.deutschflow.moderation.entity.ContentReport.Status;
import com.deutschflow.moderation.service.ContentReportService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Admin triage of user-filed content reports (Apple Guideline 1.2). */
@RestController
@RequestMapping("/api/admin/moderation")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminModerationController {

    private final ContentReportService reportService;

    /** Most recent reports, optionally filtered by status (PENDING / RESOLVED / DISMISSED). */
    @GetMapping("/reports")
    public List<ReportDto> reports(@RequestParam(required = false) Status status) {
        return reportService.list(status);
    }

    /** Resolve or dismiss a report. */
    @PostMapping("/reports/{id}/resolve")
    public ResponseEntity<Void> resolve(@AuthenticationPrincipal User admin,
                                        @PathVariable Long id,
                                        @RequestParam Status status) {
        reportService.resolve(admin.getId(), id, status);
        return ResponseEntity.noContent().build();
    }
}
