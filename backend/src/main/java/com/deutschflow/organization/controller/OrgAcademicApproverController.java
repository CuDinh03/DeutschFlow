package com.deutschflow.organization.controller;

import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.dto.AcademicApproverDto;
import com.deutschflow.organization.dto.GrantAcademicApproverRequest;
import com.deutschflow.organization.service.OrgAcademicApproverService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Phân công người duyệt học vụ (PR-2, P01). orgId từ principal như các org controller khác;
 * quyền thật kiểm trong service: XEM = org-admin, GÁN/THU HỒI = OWNER (giám đốc) — kể cả gọi
 * API trực tiếp (nền cho AC19: giáo viên trưởng không tự mở rộng quyền).
 */
@RestController
@RequestMapping("/api/org/academic-approvers")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class OrgAcademicApproverController {

    private final OrgAcademicApproverService approverService;

    @GetMapping
    public List<AcademicApproverDto> list(@AuthenticationPrincipal User user) {
        return approverService.list(user.getId(), requireOrgId(user));
    }

    @PostMapping
    public AcademicApproverDto grant(@AuthenticationPrincipal User user,
                                     @RequestBody GrantAcademicApproverRequest req) {
        return approverService.grant(user.getId(), requireOrgId(user), req);
    }

    @DeleteMapping("/{approverId}")
    public ResponseEntity<Void> revoke(@AuthenticationPrincipal User user, @PathVariable Long approverId) {
        approverService.revoke(user.getId(), requireOrgId(user), approverId);
        return ResponseEntity.noContent().build();
    }

    private Long requireOrgId(User user) {
        Long orgId = user.getOrgId();
        if (orgId == null) {
            throw new ForbiddenException("Bạn không thuộc tổ chức nào");
        }
        return orgId;
    }
}
