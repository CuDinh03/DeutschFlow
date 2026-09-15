package com.deutschflow.organization.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.dto.OrgCertificateRowDto;
import com.deutschflow.organization.dto.RevokeCertificateRequest;
import com.deutschflow.teacher.service.OrgCertificateService;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Sổ chứng nhận TOÀN TRUNG TÂM (DEC-20, chốt 09/09/2026): "giáo viên vẫn cấp, KHÔNG thêm bước
 * duyệt; nhưng giám đốc xem được danh sách toàn trung tâm và THU HỒI được".
 *
 * <p>Khác {@code /api/v2/teacher/certificates} (giáo viên, theo lớp mình phụ trách) ở phạm vi và
 * quyền: đọc = OWNER/MANAGER ({@code OrgGuard.assertOrgAdmin}); thu hồi = CHỈ OWNER
 * ({@code OrgGuard.assertOrgOwner}) và bắt buộc lý do. Như mọi endpoint org: orgId lấy từ principal
 * ({@code user.getOrgId()}), không nhận từ client; chứng nhận của trung tâm khác ⇒ 404.
 * Ghi vết nằm trong service (cùng transaction với mutation — xem {@link AuditActor}).
 */
@RestController
@RequestMapping("/api/org/certificates")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class OrgCertificateRegistryController {

    private final OrgCertificateService certificateService;

    /**
     * Danh sách phân trang, lọc phía máy chủ.
     *
     * @param classId tuỳ chọn — chỉ chứng nhận cấp từ lớp này
     * @param active  tuỳ chọn — {@code true} còn hiệu lực, {@code false} đã thu hồi, bỏ trống = cả hai
     * @param q       tuỳ chọn — tên học viên in trên chứng nhận
     * @return phong bì {@code {items, total, page, size}}
     */
    @GetMapping
    public Map<String, Object> list(
            @AuthenticationPrincipal User user,
            @RequestParam(required = false) Long classId,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        Long orgId = requireOrgId(user);
        return certificateService.listByOrg(user.getId(), orgId, classId, active, q, page, size);
    }

    /**
     * Giám đốc thu hồi kèm lý do. Đã thu hồi rồi ⇒ vẫn 200 với dòng hiện tại (idempotent).
     * {@code required = false}: thân rỗng phải thành 400 "thiếu lý do" ở service, không phải 500.
     */
    @PostMapping("/{certificateId}/revoke")
    public OrgCertificateRowDto revoke(
            @AuthenticationPrincipal User user,
            @PathVariable Long certificateId,
            @RequestBody(required = false) RevokeCertificateRequest body
    ) {
        Long orgId = requireOrgId(user);
        String reason = body == null ? null : body.reason();
        return certificateService.revokeByOrgOwner(AuditActor.of(user), orgId, certificateId, reason);
    }

    private static Long requireOrgId(User user) {
        Long orgId = user == null ? null : user.getOrgId();
        if (orgId == null) {
            throw new ForbiddenException("Bạn không thuộc tổ chức nào");
        }
        return orgId;
    }
}
