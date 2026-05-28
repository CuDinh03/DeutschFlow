package com.deutschflow.user.controller;

import com.deutschflow.user.dto.AuthResponse;
import com.deutschflow.user.dto.LoginRequest;
import com.deutschflow.user.dto.RefreshRequest;
import com.deutschflow.user.dto.RegisterRequest;
import com.deutschflow.user.dto.UpdateLocaleRequest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.service.AuthService;
import com.deutschflow.user.service.AuthRateLimiterService;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.RateLimitExceededException;
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

    private final AuthService authService;
    private final AuthRateLimiterService authRateLimiterService;

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
        AuthResponse authResp = authService.register(request);
        setRefreshTokenCookie(authResp.refreshToken(), httpResponse);
        return isMobileRequest(httpRequest) ? authResp : stripRefreshToken(authResp);
    }

    /** 200 OK — đăng nhập thành công. */
    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request,
                              HttpServletRequest httpRequest,
                              HttpServletResponse httpResponse) {
        String ip = resolveClientIp(httpRequest);
        if (!authRateLimiterService.allow(ip, request.email())) {
            throw new RateLimitExceededException(
                    "Too many login attempts. Please try again later.",
                    authRateLimiterService.retryAfterSeconds());
        }
        AuthResponse authResp = authService.login(request);
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
                resp.industry()
        );
    }

    // ─── Utility ──────────────────────────────────────────────────────────────

    /** True when the request comes from the Capacitor iOS/Android native app. */
    private static boolean isMobileRequest(HttpServletRequest request) {
        String platform = request.getHeader("X-Platform");
        return platform != null && (platform.equalsIgnoreCase("ios") || platform.equalsIgnoreCase("android"));
    }

    private static String resolveClientIp(HttpServletRequest request) {
        if (request == null) return "";
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
