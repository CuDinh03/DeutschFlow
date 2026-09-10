package com.deutschflow.teacher.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.teacher.dto.CertificateDto;
import com.deutschflow.teacher.dto.CertificateSummaryDto;
import com.deutschflow.teacher.dto.IssueCertificateRequest;
import com.deutschflow.teacher.service.OrgCertificateService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Teacher-facing co-branded certificate API (checklist D5). A teacher issues certificates to
 * students in their own classes; the center co-brand is derived from the teacher's org.
 * Served under {@code /api/v2/teacher} like the rest of the active teacher API.
 *
 * <p>DEC-20: giáo viên vẫn cấp/thu hồi ở đây, không có bước duyệt; sổ toàn trung tâm và thu hồi
 * của giám đốc nằm ở {@code /api/org/certificates}. Actor được dựng ở controller và truyền xuống để
 * service ghi vết trong cùng transaction (xem {@link AuditActor}).
 */
@RestController
@RequestMapping("/api/v2/teacher/certificates")
@RequiredArgsConstructor
@PreAuthorize("hasRole('TEACHER')")
public class OrgCertificateController {

    private final OrgCertificateService certificateService;

    @PostMapping
    public CertificateDto issue(@AuthenticationPrincipal User teacher,
                                @RequestBody IssueCertificateRequest request) {
        return certificateService.issue(AuditActor.of(teacher), request);
    }

    @GetMapping("/class/{classId}")
    public List<CertificateSummaryDto> listForClass(@AuthenticationPrincipal User teacher,
                                                    @PathVariable Long classId) {
        return certificateService.listByClass(teacher.getId(), classId);
    }

    @PostMapping("/{certificateId}/revoke")
    public ResponseEntity<Void> revoke(@AuthenticationPrincipal User teacher,
                                       @PathVariable Long certificateId) {
        certificateService.revokeByTeacher(AuditActor.of(teacher), certificateId);
        return ResponseEntity.noContent().build();
    }
}
