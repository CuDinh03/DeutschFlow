package com.deutschflow.user.controller;

import com.deutschflow.teacher.dto.StudentCertificateDto;
import com.deutschflow.teacher.service.OrgCertificateService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Học viên xem chứng nhận trung tâm đã cấp cho mình (đợt 4A A+B+E). Chỉ của chính mình, không nhận
 * tham số id nào từ client. Khác {@code /api/certificates/me}: đó là ghi nhận thi thử tự động.
 */
@RestController
@RequestMapping("/api/student/certificates")
@RequiredArgsConstructor
@PreAuthorize("hasRole('STUDENT')")
public class StudentCertificateController {

    private final OrgCertificateService certificateService;

    @GetMapping
    public List<StudentCertificateDto> mine(@AuthenticationPrincipal User user) {
        return certificateService.listForStudent(user.getId());
    }
}
