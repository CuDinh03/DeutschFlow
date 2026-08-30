package com.deutschflow.user.controller;

import com.deutschflow.user.dto.AuthResponse;
import com.deutschflow.user.dto.LoginRequest;
import com.deutschflow.user.dto.RefreshRequest;
import com.deutschflow.user.dto.RegisterRequest;
import com.deutschflow.user.dto.UpdateLocaleRequest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.service.AuthService;
import com.deutschflow.user.service.AuthConcurrencyLimiter;
import com.deutschflow.user.service.AuthRateLimiterService;
import com.deutschflow.user.service.PasswordResetService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.RateLimitExceededException;
import com.deutschflow.common.security.ClientIpResolver;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import java.util.function.Supplier;

/**
 * Auth endpoints: login, register, refresh, logout, me.
 *
 * <p><b>Refresh token strategy (HttpOnly cookie):</b>
 * Sau login/register/refresh, backend set cookie {@code refresh_token} với flag
 * {@code HttpOnly; Secure; SameSite=Strict; Path=/api/auth}.
 * JS không thể đọc cookie này — chỉ browser tự gửi khi gọi {@code /api/auth/refresh}.
 * Body response KHÔNG còn chứa {@code refreshToken} (luôn null) để tránh rủi ro XSS.
 *
 * <p><b>Backwards compat:</b> Nếu cookie vắng mặt (client cũ), controller fallback đọc
 * {@code refreshToken} từ body request. Fallback này sẽ bị bỏ sau vài sprint.
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private static final String REFRESH_TOKEN_COOKIE = "refresh_token";

    private static final String BUSY_MESSAGE = "Server is busy. Please try again in a moment.";

    private final AuthService authService;
    private final AuthRateLimiterService authRateLimiterService;
    private final AuthConcurrencyLimiter authConcurrencyLimiter;
    private final PasswordResetService passwordResetService;
    private final ClientIpResolver clientIpResolver;

    @Value("${app.jwt.refresh-token-expiry-ms}")
    private long refreshTokenExpiryMs;

    // ─── Public endpoints ──────────────────────────────────────────────────────

    /** 201 Created — tài khoản mới. */
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(@Valid @RequestBody RegisterRequest request,
                                 HttpServletRequest httpRequest,
                                 HttpServletResponse httpResponse) {
        String ip = resolveClientIp(httpRequest);
        if (!authRateLimiterService.allowRegister(ip)) {
            throw new RateLimitExceededException(
                    "Too many registration attempts. Please try again later.",
                    authRateLimiterService.registerRetryAfterSeconds());
        }
        AuthResponse authResp = withAuthBulkhead(() -> authService.register(request));
        setRefreshTokenCookie(authResp.refreshToken(), httpResponse);
        return isMobileRequest(httpRequest) ? authResp : stripRefreshToken(authResp);
    }

    /** 200 OK — đăng nhập thành công. */
    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request,
                              HttpServletRequest httpRequest,
                              HttpServletResponse httpResponse) {
        String ip = resolveClientIp(httpRequest);
        // Per-IP budget FIRST, and before anything expensive. A login attempt costs a full BCrypt
        // hash even when the email does not exist (DaoAuthenticationProvider's timing-attack
        // mitigation hashes against a dummy for unknown users), so this guard is only worth having
        // if it short-circuits before authService.login(). The (IP + email) budget below cannot do
        // that job on its own — rotating the email mints a fresh bucket on every request.
        if (!authRateLimiterService.allowLoginPerIp(ip)) {
            throw new RateLimitExceededException(
                    "Too many login attempts. Please try again later.",
                    authRateLimiterService.loginIpRetryAfterSeconds());
        }
        if (!authRateLimiterService.allow(ip, request.email())) {
            throw new RateLimitExceededException(
                    "Too many login attempts. Please try again later.",
                    authRateLimiterService.retryAfterSeconds());
        }
        AuthResponse authResp = withAuthBulkhead(() -> authService.login(request));
        setRefreshTokenCookie(authResp.refreshToken(), httpResponse);
        // Native mobile clients (Capacitor) cannot use HttpOnly cookies cross-origin.
        // They send X-Platform header and receive the refresh token in the body instead.
        return isMobileRequest(httpRequest) ? authResp : stripRefreshToken(authResp);
    }

    /**
     * 200 OK — cấp access token mới từ refresh token.
     *
     * <p>Ưu tiên đọc token từ HttpOnly cookie {@code refresh_token}.
     * Fallback body {@code refreshToken} (tương thích client cũ).
     */
    @PostMapping("/refresh")
    public AuthResponse refresh(
            @CookieValue(name = REFRESH_TOKEN_COOKIE, required = false) String cookieToken,
            @RequestBody(required = false) RefreshRequest bodyRequest,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {

        String ip = resolveClientIp(httpRequest);
        if (!authRateLimiterService.allowRefresh(ip)) {
            throw new RateLimitExceededException(
                    "Too many refresh attempts. Please try again later.",
                    authRateLimiterService.refreshRetryAfterSeconds());
        }

        // Cookie ưu tiên; body là fallback cho client cũ
        String token = (cookieToken != null && !cookieToken.isBlank())
                ? cookieToken
                : (bodyRequest != null ? bodyRequest.refreshToken() : null);

        if (token == null || token.isBlank()) {
            throw new BadRequestException("Refresh token is required");
        }

        AuthResponse authResp = authService.refresh(token);
        setRefreshTokenCookie(authResp.refreshToken(), httpResponse);
        return isMobileRequest(httpRequest) ? authResp : stripRefreshToken(authResp);
    }

    // ─── Authenticated endpoints ───────────────────────────────────────────────

    /** 204 No Content — đăng xuất, revoke refresh tokens, xóa cookie. */
    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@AuthenticationPrincipal User user,
                       HttpServletResponse httpResponse) {
        authService.logout(user.getId());
        clearRefreshTokenCookie(httpResponse);
    }

    /** 200 OK — thông tin user hiện tại. */
    @GetMapping("/me")
    public AuthResponse me(@AuthenticationPrincipal User user) {
        return authService.me(user);
    }

    /** 200 OK — cập nhật ngôn ngữ giao diện (vi | en | de). */
    @PatchMapping("/me/locale")
    public AuthResponse patchLocale(@AuthenticationPrincipal User user,
                                    @Valid @RequestBody UpdateLocaleRequest request) {
        return authService.updateLocale(user, request.locale());
    }

    // ─── Password reset (unauthenticated) ─────────────────────────────────────

    /**
     * POST /api/auth/forgot-password
     * Request a 6-digit OTP sent to the given email. Always returns 204 to prevent
     * email enumeration. Rate-limited per (IP + email) to block email-bombing.
     */
    @PostMapping("/forgot-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void forgotPassword(@Valid @RequestBody ForgotPasswordRequest req,
                               HttpServletRequest httpRequest) {
        String ip = resolveClientIp(httpRequest);
        if (!authRateLimiterService.allowPasswordReset(ip, req.email())) {
            throw new RateLimitExceededException(
                    "Too many password reset requests. Please try again later.",
                    authRateLimiterService.passwordResetRetryAfterSeconds());
        }
        passwordResetService.requestReset(req.email());
    }

    /**
     * POST /api/auth/reset-password
     * Verifies the OTP and updates the password. Returns 204 on success.
     * Rate-limited per (IP + email) to block brute-forcing the 6-digit OTP.
     */
    @PostMapping("/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(@Valid @RequestBody ResetPasswordRequest req,
                              HttpServletRequest httpRequest) {
        String ip = resolveClientIp(httpRequest);
        if (!authRateLimiterService.allowPasswordReset(ip, req.email())) {
            throw new RateLimitExceededException(
                    "Too many password reset attempts. Please try again later.",
                    authRateLimiterService.passwordResetRetryAfterSeconds());
        }
        if (req.newPassword().length() < 8) {
            throw new BadRequestException("Mật khẩu mới phải có ít nhất 8 ký tự.");
        }
        passwordResetService.resetPassword(req.email(), req.code(), req.newPassword());
    }

    public record ForgotPasswordRequest(
            @jakarta.validation.constraints.NotBlank
            @jakarta.validation.constraints.Email
            String email
    ) {}

    public record ResetPasswordRequest(
            @jakarta.validation.constraints.NotBlank
            @jakarta.validation.constraints.Email
            String email,
            @jakarta.validation.constraints.NotBlank
            @jakarta.validation.constraints.Size(min = 6, max = 6)
            String code,
            @jakarta.validation.constraints.NotBlank
            String newPassword
    ) {}

    // ─── Cookie helpers ────────────────────────────────────────────────────────

    /**
     * Đặt refresh token vào HttpOnly cookie.
     *
     * <ul>
     *   <li>{@code HttpOnly} — JS không đọc được; ngăn XSS đánh cắp.</li>
     *   <li>{@code Secure} — chỉ gửi qua HTTPS.</li>
     *   <li>{@code SameSite=Strict} — chặn CSRF: cookie không được gửi trong cross-site request.</li>
     *   <li>{@code Path=/api/auth} — cookie chỉ đính kèm vào auth endpoints, không phải mọi request.</li>
     * </ul>
     */
    private void setRefreshTokenCookie(String refreshToken, HttpServletResponse response) {
        if (refreshToken == null) return;
        ResponseCookie cookie = ResponseCookie.from(REFRESH_TOKEN_COOKIE, refreshToken)
                .httpOnly(true)
                .secure(true)
                .sameSite("Strict")
                .path("/api/auth")
                .maxAge(Duration.ofMillis(refreshTokenExpiryMs))
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    /** Xóa cookie refresh token (maxAge=0 để browser discard ngay). */
    private void clearRefreshTokenCookie(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from(REFRESH_TOKEN_COOKIE, "")
                .httpOnly(true)
                .secure(true)
                .sameSite("Strict")
                .path("/api/auth")
                .maxAge(0)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    /**
     * Trả về AuthResponse không kèm refreshToken trong body.
     * Refresh token đã được set vào HttpOnly cookie — không để JS đọc được.
     */
    private static AuthResponse stripRefreshToken(AuthResponse resp) {
        return new AuthResponse(
                resp.accessToken(),
                null,           // refreshToken removed from body — now in HttpOnly cookie
                resp.userId(),
                resp.email(),
                resp.displayName(),
                resp.role(),
                resp.locale(),
                resp.learningTargetLevel(),
                resp.industry(),
                resp.orgId(),
                resp.orgRole(),
                resp.avatarUrl()
        );
    }

    // ─── Utility ──────────────────────────────────────────────────────────────

    /** True when the request comes from the Capacitor iOS/Android native app. */
    private static boolean isMobileRequest(HttpServletRequest request) {
        String platform = request.getHeader("X-Platform");
        return platform != null && (platform.equalsIgnoreCase("ios") || platform.equalsIgnoreCase("android"));
    }

    /**
     * Chạy phần đắt (BCrypt) bên trong bulkhead.
     *
     * <p>Rate-limit theo IP ở trên chặn kẻ tấn công ĐƠN LẺ. Nó không chặn được tấn công phân tán:
     * mười nghìn IP mỗi cái một request/giây thì không IP nào chạm ngưỡng, nhưng tổng lại lấp kín
     * cả 48 Tomcat thread bằng BCrypt và kéo sập luôn những endpoint chẳng liên quan gì tới auth.
     * Bulkhead khoanh thiệt hại: quá tải thì auth trả 429, phần còn lại của app vẫn còn thread chạy.
     *
     * <p>release() nằm trong finally — rò rỉ một permit là khoá cứng auth vĩnh viễn cho tới lần
     * restart sau, nên đây là chỗ không được phép sai.
     */
    private <T> T withAuthBulkhead(Supplier<T> expensive) {
        boolean acquired;
        try {
            acquired = authConcurrencyLimiter.tryAcquire();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RateLimitExceededException(
                    BUSY_MESSAGE, authConcurrencyLimiter.retryAfterSeconds());
        }
        if (!acquired) {
            throw new RateLimitExceededException(
                    BUSY_MESSAGE, authConcurrencyLimiter.retryAfterSeconds());
        }
        try {
            return expensive.get();
        } finally {
            authConcurrencyLimiter.release();
        }
    }

    /** Uỷ quyền cho {@link ClientIpResolver} — logic chống giả mạo X-Forwarded-For chỉ nên có MỘT bản. */
    private String resolveClientIp(HttpServletRequest request) {
        return clientIpResolver.resolve(request);
    }
}
