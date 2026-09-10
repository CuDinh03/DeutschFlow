package com.deutschflow.user.controller;

import com.deutschflow.teacher.dto.ReportIssueDtos.ReportIssueDto;
import com.deutschflow.teacher.service.ReportIssueService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Học viên xem ĐÚNG bản phiếu đã gửi gia đình (R6) — đọc từ {@code payload_json} đã đóng băng, mọi
 * trạng thái (ACTIVE/EXPIRED/SUPERSEDED/REVOKED) để em ấy biết bản nào còn mở được. Chỉ phiếu của
 * chính mình; không có tham số id nào nhận từ client.
 */
@RestController
@RequestMapping("/api/student/report-issues")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class StudentReportIssueController {

    private final ReportIssueService reportIssueService;

    @GetMapping
    public List<ReportIssueDto> mine(@AuthenticationPrincipal User user) {
        return reportIssueService.listForStudent(user.getId());
    }
}
