package com.deutschflow.organization.controller;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.organization.dto.OrgGuardianConsentDtos.ConsentDto;
import com.deutschflow.organization.dto.OrgGuardianConsentDtos.ConsentRequest;
import com.deutschflow.organization.dto.OrgGuardianConsentDtos.GuardianDto;
import com.deutschflow.organization.dto.OrgGuardianConsentDtos.GuardianRequest;
import com.deutschflow.organization.service.OrgGuardianConsentService;
import com.deutschflow.organization.service.OrgGuard;
import com.deutschflow.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Trung tâm xem/sửa người giám hộ và ghi/thu hồi phiếu đồng ý của một học viên (D1/R11, owner chốt
 * 10/09/2026). Đây là nửa "ca lẻ + màn nhỏ" của đường ghi đồng ý; nửa "hàng loạt" là cột CSV
 * {@code consentConfirmed} ở {@code POST /api/org/students/import}.
 *
 * <p><b>orgId lấy từ ngữ cảnh người gọi, không nhận qua tham số</b> — cùng khuôn
 * {@link OrgMinorMessageController}. Đọc: OWNER/MANAGER ({@code assertOrgAdmin}). Ghi: thêm cổng
 * trạng thái trung tâm ({@code assertOrgAdminForWrite}) — trung tâm bị đình chỉ/hết hạn vẫn XEM được
 * hồ sơ giám hộ nhưng không ghi thêm gì. Học viên phải là thành viên ACTIVE của chính trung tâm đó,
 * nếu không 404 (xem javadoc {@link OrgGuardianConsentService}).
 *
 * <p>Vết audit ghi ở SERVICE ({@code MinorLearnerService}: {@code student_guardian_recorded},
 * {@code student_guardian_updated}, {@code student_consent_recorded}) — trong cùng transaction với
 * mutation, đúng nguyên tắc của {@code AuditActor}. Đường đọc không ghi vết: đây là hồ sơ liên lạc
 * và sổ bằng chứng mà chính trung tâm đã nhập, không phải nội dung riêng tư của trẻ như tin nhắn.
 *
 * <p>Không có DELETE cho cả hai tài nguyên — {@code StudentGuardianRepository} và
 * {@code StudentConsentRepository} cố ý không có đường xoá; thu hồi đồng ý = POST một dòng
 * {@code REVOKED}.
 */
@RestController
@RequestMapping("/api/org/students/{userId}")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class OrgGuardianConsentController {

    private final OrgGuard orgGuard;
    private final OrgGuardianConsentService service;

    // ── Người giám hộ ────────────────────────────────────────────────────────

    @GetMapping("/guardians")
    public List<GuardianDto> listGuardians(@AuthenticationPrincipal User user, @PathVariable Long userId) {
        Long orgId = requireOrgId(user);
        orgGuard.assertOrgAdmin(user.getId(), orgId);
        return service.listGuardians(orgId, userId);
    }

    @PostMapping("/guardians")
    @ResponseStatus(HttpStatus.CREATED)
    public GuardianDto addGuardian(@AuthenticationPrincipal User user, @PathVariable Long userId,
                                   @RequestBody(required = false) GuardianRequest body) {
        Long orgId = requireOrgId(user);
        orgGuard.assertOrgAdminForWrite(user.getId(), orgId);
        return service.addGuardian(orgId, userId, body, AuditActor.of(user));
    }

    @PutMapping("/guardians/{guardianId}")
    public GuardianDto updateGuardian(@AuthenticationPrincipal User user, @PathVariable Long userId,
                                      @PathVariable Long guardianId,
                                      @RequestBody(required = false) GuardianRequest body) {
        Long orgId = requireOrgId(user);
        orgGuard.assertOrgAdminForWrite(user.getId(), orgId);
        return service.updateGuardian(orgId, userId, guardianId, body, AuditActor.of(user));
    }

    // ── Sổ đồng ý ────────────────────────────────────────────────────────────

    /** Sổ đồng ý, mới nhất trước — đường đọc bằng chứng của trung tâm. */
    @GetMapping("/consents")
    public List<ConsentDto> consentLedger(@AuthenticationPrincipal User user, @PathVariable Long userId) {
        Long orgId = requireOrgId(user);
        orgGuard.assertOrgAdmin(user.getId(), orgId);
        return service.consentLedger(orgId, userId);
    }

    /**
     * Ghi thêm một dòng: {@code action=GRANTED} (cấp) hoặc {@code REVOKED} (thu hồi). Sổ chỉ-ghi-thêm:
     * không có PUT/DELETE, và sẽ không bao giờ có.
     */
    @PostMapping("/consents")
    @ResponseStatus(HttpStatus.CREATED)
    public ConsentDto recordConsent(@AuthenticationPrincipal User user, @PathVariable Long userId,
                                    @RequestBody(required = false) ConsentRequest body) {
        Long orgId = requireOrgId(user);
        orgGuard.assertOrgAdminForWrite(user.getId(), orgId);
        return service.recordConsent(orgId, userId, body, AuditActor.of(user));
    }

    private static Long requireOrgId(User user) {
        Long orgId = user.getOrgId();
        if (orgId == null) {
            throw new ForbiddenException("Bạn không thuộc tổ chức nào");
        }
        return orgId;
    }
}
