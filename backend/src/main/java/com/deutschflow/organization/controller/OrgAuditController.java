package com.deutschflow.organization.controller;

import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.service.OrgGuard;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Sổ hoạt động của trung tâm (C6 — kế hoạch B2B §8).
 *
 * <p>OWNER-only, cùng lý do với {@code OrgSettingsController}: đây là bằng chứng vận hành của giám
 * đốc trung tâm (ai gỡ ai khỏi lớp, ai đổi ghế, ai xoá gì), không phải việc hằng ngày của MANAGER.
 *
 * <p>Khác {@code /api/admin/audit-logs} (ADMIN hệ thống, thấy toàn bộ) ở đúng một điểm: mọi truy vấn
 * ở đây bị ép {@code org_id = <trung tâm của người gọi>} trong SQL, không nhận orgId từ tham số —
 * nên không có đường nào để một OWNER đọc sổ của trung tâm khác kể cả khi đoán đúng id.
 */
@RestController
@RequestMapping("/api/org/audit-logs")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class OrgAuditController {

    private final AuditLogService auditLogService;
    private final OrgGuard orgGuard;

    @GetMapping
    public Map<String, Object> list(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String cat,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Long orgId = user.getOrgId();
        if (orgId == null) {
            throw new ForbiddenException("Bạn không thuộc tổ chức nào");
        }
        orgGuard.assertOrgOwner(user.getId(), orgId);
        return auditLogService.readOrgAuditLogs(orgId, q, cat, page, size);
    }
}
