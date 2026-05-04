package com.deutschflow.user.controller;

import com.deutschflow.user.dto.AuthResponse;
import com.deutschflow.user.dto.LoginRequest;
import com.deutschflow.user.dto.RefreshRequest;
import com.deutschflow.user.dto.RegisterRequest;
import com.deutschflow.user.dto.UpdateLocaleRequest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.service.AuthService;
import com.deutschflow.user.service.AuthRateLimiterService;
import com.deutschflow.common.exception.RateLimitExceededException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final AuthRateLimiterService authRateLimiterService;

    /** 201 Created — tài khoản mới */
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    /** 200 OK — đăng nhập thành công */
    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        String ip = resolveClientIp(httpRequest);
        if (!authRateLimiterService.allow(ip, request.email())) {
            throw new RateLimitExceededException(
                    "Too many login attempts. Please try again later.",
                    authRateLimiterService.retryAfterSeconds()
            );
        }
        return authService.login(request);
    }

    /** 200 OK — cấp access token mới từ refresh token */
    @PostMapping("/refresh")
    public AuthResponse refresh(@Valid @RequestBody RefreshRequest request) {
        return authService.refresh(request);
    }

    /** 204 No Content — đăng xuất, revoke refresh tokens */
    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@AuthenticationPrincipal User user) {
        authService.logout(user.getId());
    }

    /** 200 OK — lấy thông tin user hiện tại */
    @GetMapping("/me")
    public AuthResponse me(@AuthenticationPrincipal User user) {
        return authService.me(user);
    }

    /** 200 OK — cập nhật ngôn ngữ giao diện (vi | en | de) */
    @PatchMapping("/me/locale")
    public AuthResponse patchLocale(@AuthenticationPrincipal User user,
                                    @Valid @RequestBody UpdateLocaleRequest request) {
        return authService.updateLocale(user, request.locale());
    }

    private static String resolveClientIp(HttpServletRequest request) {
        if (request == null) return null;
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
