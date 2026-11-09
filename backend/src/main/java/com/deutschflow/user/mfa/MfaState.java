package com.deutschflow.user.mfa;

import com.deutschflow.common.security.AuthTokenAttributes;
import com.deutschflow.common.security.JwtService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Instant;

/**
 * Trạng thái 2FA của một phiên sắp được cấp: {@code verifiedAt} = lúc người dùng qua bước 2FA, hoặc
 * {@code null} khi phiên không qua 2FA (người dùng thường, hoặc ADMIN lúc tắt kill-switch).
 *
 * <p>Đi vào {@code AuthService.buildAuthResponse}: access token mang claim {@code mfa}/{@code mfa_at},
 * dòng refresh mang {@code mfa_verified_at}.
 */
public record MfaState(Instant verifiedAt) {

    public static final MfaState NONE = new MfaState(null);

    public static MfaState verifiedAt(Instant at) {
        return at == null ? NONE : new MfaState(at);
    }

    public boolean verified() {
        return verifiedAt != null;
    }

    /** Đọc từ claims của access token đã verify ({@code mfa=true} + {@code mfa_at} giây epoch). */
    public static MfaState fromClaims(Claims claims) {
        Instant at = JwtService.mfaVerifiedAt(claims);
        return verifiedAt(at);
    }

    /**
     * Trạng thái 2FA của request đang xử lý — {@code JwtAuthFilter} đặt claims vào
     * {@link AuthTokenAttributes#CLAIMS}. Ngoài request (job, test) hoặc request không xác thực bằng JWT →
     * {@link #NONE}.
     */
    public static MfaState fromCurrentRequest() {
        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs)) {
            return NONE;
        }
        HttpServletRequest request = attrs.getRequest();
        Object claims = request.getAttribute(AuthTokenAttributes.CLAIMS);
        return claims instanceof Claims c ? fromClaims(c) : NONE;
    }
}
