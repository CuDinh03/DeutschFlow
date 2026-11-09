package com.deutschflow.admin.support;

import com.deutschflow.common.security.support.SupportSessionContext;
import com.deutschflow.user.entity.User;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Endpoint của phiên hỗ trợ chỉ-đọc (V370).
 *
 * <ul>
 *   <li>{@code POST /api/admin/users/{id}/support-session} {@code {reason}} — ADMIN mở phiên → {@code {sessionId,
 *       handoffCode, expiresAt}}.</li>
 *   <li>{@code GET /api/admin/users/{id}/support-sessions} — 20 phiên gần nhất xem người dùng này (tab hồ sơ).</li>
 *   <li>{@code POST /api/admin/support-sessions/{id}/end} — ADMIN đóng phiên.</li>
 *   <li>{@code POST /api/auth/support-session/redeem} {@code {code}} — tab mới đổi mã + cookie refresh của admin
 *       lấy token support (permitAll; xem {@link SupportSessionService#redeem}).</li>
 *   <li>{@code POST /api/support-session/end} — tab hỗ trợ tự đóng (gọi BẰNG token support; đường ghi duy nhất
 *       {@link SupportSessionReadOnlyFilter} cho qua).</li>
 * </ul>
 */
@RestController
@RequiredArgsConstructor
public class SupportSessionController {

    private final SupportSessionService service;

    public record StartRequest(String reason) {
    }

    public record RedeemRequest(String code) {
    }

    @PostMapping("/api/admin/users/{id}/support-session")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SupportSessionService.StartResult> start(@PathVariable("id") long targetUserId,
                                                                   @RequestBody(required = false) StartRequest body,
                                                                   @AuthenticationPrincipal User admin) {
        var result = service.start(admin, targetUserId, body == null ? null : body.reason());
        return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore()).body(result);
    }

    @GetMapping("/api/admin/users/{id}/support-sessions")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> list(@PathVariable("id") long targetUserId) {
        List<Map<String, Object>> items = service.listForTarget(targetUserId);
        return Map.of("items", items);
    }

    @PostMapping("/api/admin/support-sessions/{id}/end")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> endByAdmin(@PathVariable("id") long sessionId, @AuthenticationPrincipal User admin) {
        return Map.of("ended", service.endByAdmin(sessionId, admin));
    }

    @PostMapping("/api/auth/support-session/redeem")
    public ResponseEntity<SupportSessionService.RedeemResult> redeem(
            @RequestBody(required = false) RedeemRequest body,
            @CookieValue(name = "refresh_token", required = false) String refreshCookie) {
        var result = service.redeem(body == null ? null : body.code(), refreshCookie);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(result);
    }

    @PostMapping("/api/support-session/end")
    public Map<String, Object> endFromSupportTab(HttpServletRequest request) {
        if (!(request.getAttribute(SupportSessionContext.REQUEST_ATTRIBUTE) instanceof SupportSessionContext ctx)) {
            throw new SupportSessionException(HttpStatus.FORBIDDEN, SupportSessionException.HANDOFF_INVALID,
                    "Chỉ gọi được từ tab phiên hỗ trợ.");
        }
        return Map.of("ended", service.endFromSupportTab(ctx));
    }
}
