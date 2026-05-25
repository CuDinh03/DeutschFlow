package com.deutschflow.common.controller;

import com.deutschflow.common.security.JwtService;
import com.deutschflow.user.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;

/**
 * Temporary diagnostic endpoint for troubleshooting JWT and authentication issues.
 * Remove in production.
 */
@Slf4j
@RestController
@RequestMapping("/api/diagnostics")
@RequiredArgsConstructor
public class DiagnosticsController {

    private final JwtService jwtService;

    /**
     * GET /api/diagnostics/time - Check server time
     * Useful for detecting clock skew
     */
    @GetMapping("/time")
    public Map<String, Object> getServerTime() {
        long currentTimeMs = System.currentTimeMillis();
        Map<String, Object> response = new HashMap<>();
        response.put("currentTimeMs", currentTimeMs);
        response.put("currentDate", new Date(currentTimeMs));
        response.put("epochSeconds", currentTimeMs / 1000);
        log.info("[Diagnostics] Server time: {} ({})", new Date(currentTimeMs), currentTimeMs);
        return response;
    }

    /**
     * POST /api/diagnostics/validate-token - Validate a JWT token
     * Body: { "token": "eyJhbGc..." }
     */
    @PostMapping("/validate-token")
    public Map<String, Object> validateToken(@RequestBody Map<String, String> body) {
        String token = body.get("token");
        if (token == null || token.isEmpty()) {
            return Map.of("error", "Token is required in body: { \"token\": \"...\" }");
        }

        Map<String, Object> response = new HashMap<>();
        response.put("tokenLength", token.length());
        response.put("isValid", jwtService.isTokenValid(token));

        try {
            Claims claims = jwtService.extractClaims(token);
            response.put("email", claims.getSubject());
            response.put("role", claims.get("role", String.class));
            response.put("userId", claims.get("userId", Long.class));
            response.put("issuedAt", claims.getIssuedAt());
            response.put("expiration", claims.getExpiration());

            long nowMs = System.currentTimeMillis();
            long expMs = claims.getExpiration().getTime();
            long remainingMs = expMs - nowMs;

            response.put("nowMs", nowMs);
            response.put("expMs", expMs);
            response.put("remainingMs", remainingMs);
            response.put("remainingSeconds", remainingMs / 1000);
            response.put("isExpired", remainingMs < 0);

            log.info("[Diagnostics] Token validation result - email: {}, role: {}, remaining: {}ms, expired: {}",
                claims.getSubject(), claims.get("role"), remainingMs, remainingMs < 0);

        } catch (JwtException e) {
            response.put("error", e.getClass().getSimpleName());
            response.put("message", e.getMessage());
            log.warn("[Diagnostics] Token validation error - {}: {}", e.getClass().getSimpleName(), e.getMessage());
        }

        return response;
    }

    /**
     * GET /api/diagnostics/current-user - Get current authenticated user info
     */
    @GetMapping("/current-user")
    public Map<String, Object> getCurrentUser(@AuthenticationPrincipal User user) {
        Map<String, Object> response = new HashMap<>();
        if (user == null) {
            response.put("authenticated", false);
            response.put("message", "No authenticated user found");
            log.warn("[Diagnostics] No authenticated user found");
            return response;
        }

        response.put("authenticated", true);
        response.put("userId", user.getId());
        response.put("email", user.getEmail());
        response.put("displayName", user.getDisplayName());
        response.put("role", user.getRole().name());
        response.put("locale", user.getLocale().name());
        response.put("enabled", user.isEnabled());
        response.put("createdAt", user.getCreatedAt());

        log.info("[Diagnostics] Current user - id: {}, email: {}, role: {}", user.getId(), user.getEmail(), user.getRole());

        return response;
    }

    /**
     * GET /api/diagnostics/jwt-config - Get JWT configuration
     * Shows TTL and other settings (no secret!)
     */
    @GetMapping("/jwt-config")
    public Map<String, Object> getJwtConfig() {
        Map<String, Object> response = new HashMap<>();
        // Note: We don't expose the actual secret, just the configuration
        response.put("accessTokenTtlMs", 900000); // from application.yml
        response.put("accessTokenTtlMinutes", 15);
        response.put("refreshTokenTtlMs", 604800000); // from application.yml
        response.put("refreshTokenTtlDays", 7);
        response.put("message", "Current token TTLs. Do not expose secret in production.");
        return response;
    }

    /**
     * GET /api/diagnostics/health - Simple health check
     */
    @GetMapping("/health")
    public Map<String, String> health() {
        log.info("[Diagnostics] Health check");
        return Map.of("status", "UP", "service", "DeutschFlow Diagnostics");
    }
}
