package com.deutschflow.admin.controller;

import com.deutschflow.user.entity.User;
import com.deutschflow.user.mfa.MfaService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Đặt lại 2FA của một người dùng khác (mất điện thoại + hết mã khôi phục). Chỉ ADMIN, KHÔNG BAO GIỜ cho chính
 * mình (403 {@code MFA_RESET_SELF_FORBIDDEN}), bắt buộc lý do 10–500 ký tự như các thao tác nhạy cảm đợt 1.
 * Xoá bí mật + mã khôi phục, cắt mọi phiên, ghi vết {@code admin.user.mfa.reset}, báo cho người bị đặt lại.
 *
 * <p>Khi chỉ có MỘT admin và chính admin đó mất 2FA, đường này không dùng được — xem
 * {@code docs/RUNBOOK_2FA_ADMIN.md} (kill-switch {@code ADMIN_MFA_ENFORCED} + SQL).
 */
@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminMfaController {

    private final MfaService mfaService;

    public record ResetMfaRequest(String reason) {}

    @PostMapping("/{userId}/mfa/reset")
    public Map<String, Object> reset(@PathVariable Long userId,
                                     @RequestBody(required = false) ResetMfaRequest request,
                                     @AuthenticationPrincipal User actor) {
        if (actor != null && actor.getId() != null && actor.getId().equals(userId)) {
            // Trước cả kiểm lý do: tự đặt lại là bị cấm, không phải "thiếu lý do".
            return mfaService.adminReset(actor, userId, null);
        }
        String reason = AdminManagementController.requireReason(request == null ? null : request.reason());
        return mfaService.adminReset(actor, userId, reason);
    }
}
