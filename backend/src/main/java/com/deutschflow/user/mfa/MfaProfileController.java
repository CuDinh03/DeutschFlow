package com.deutschflow.user.mfa;

import com.deutschflow.common.security.ClientIpResolver;
import com.deutschflow.user.entity.User;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 2FA của chính người đang đăng nhập (tab Bảo mật ở {@code /v2/profile}). Hiện chỉ ADMIN có 2FA, nhưng
 * endpoint không khoá theo vai trò: người chưa bật thì {@code enabled=false} và tạo mã mới trả 409.
 */
@RestController
@RequestMapping("/api/profile/me/mfa")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class MfaProfileController {

    private final MfaService mfaService;
    private final ClientIpResolver clientIpResolver;

    public record RegenerateRequest(@NotBlank String code) {}

    /** {@code {enabled, enabledAt, recoveryCodesRemaining}}. */
    @GetMapping
    public MfaService.MfaStatus status(@AuthenticationPrincipal User user) {
        return mfaService.status(user);
    }

    /** Bộ 10 mã khôi phục MỚI (bộ cũ hết hiệu lực) — cần mã TOTP hiện tại. Mã chỉ hiện trong response này. */
    @PostMapping("/recovery-codes")
    public Map<String, List<String>> regenerate(@AuthenticationPrincipal User user,
                                                @Valid @RequestBody RegenerateRequest request,
                                                HttpServletRequest httpRequest) {
        List<String> codes = mfaService.regenerateRecoveryCodes(user, request.code(), clientIpResolver.resolve(httpRequest));
        return Map.of("recoveryCodes", codes);
    }
}
