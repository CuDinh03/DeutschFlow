package com.deutschflow.common.telemetry;

import com.deutschflow.common.security.JwtService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class ApiTelemetryFilter extends OncePerRequestFilter {

    private final ApiTelemetryService apiTelemetryService;
    private final JwtService jwtService;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return !uri.startsWith("/api/")
                || uri.startsWith("/api/quiz/")
                || uri.startsWith("/api/ws/");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        long startedAt = System.currentTimeMillis();
        String requestId = resolveRequestId(request);
        response.setHeader("X-Request-Id", requestId);
        request.setAttribute("requestId", requestId);

        try {
            filterChain.doFilter(request, response);
        } finally {
            long latencyMs = Math.max(0L, System.currentTimeMillis() - startedAt);
            int statusCode = response.getStatus();
            boolean isError = statusCode >= 400;
            Long userId = extractUserId(request);
            String role = extractRole();
            String sessionId = request.getRequestedSessionId();
            String eventName = "api.request." + (isError ? "error" : "completed");

            apiTelemetryService.record(new ApiTelemetryEvent(
                    eventName,
                    LocalDateTime.now(),
                    userId,
                    sessionId,
                    role,
                    requestId,
                    request.getMethod(),
                    request.getRequestURI(),
                    statusCode,
                    latencyMs,
                    isError
            ));
        }
    }

    private String resolveRequestId(HttpServletRequest request) {
        String header = request.getHeader("X-Request-Id");
        return (header == null || header.isBlank()) ? UUID.randomUUID().toString() : header.trim();
    }

    private Long extractUserId(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return null;
        }
        String token = authHeader.substring(7);
        if (!jwtService.isTokenValid(token)) {
            return null;
        }
        try {
            Claims claims = jwtService.extractClaims(token);
            Object raw = claims.get("userId");
            if (raw instanceof Number n) {
                return n.longValue();
            }
            if (raw != null) {
                return Long.parseLong(String.valueOf(raw));
            }
            return null;
        } catch (Exception ex) {
            return null;
        }
    }

    private String extractRole() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getAuthorities() == null || auth.getAuthorities().isEmpty()) {
            return null;
        }
        return auth.getAuthorities().iterator().next().getAuthority();
    }
}
