package com.deutschflow.common.telemetry;

import com.deutschflow.common.security.JwtService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerMapping;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.UUID;
import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
public class ApiTelemetryFilter extends OncePerRequestFilter {

    /** `endpoint` là VARCHAR(255) (V18) — cắt trước khi ghi, đừng để INSERT nổ vì một URI dài. */
    private static final int ENDPOINT_MAX_LEN = 255;

    /** Đoạn đường dẫn toàn chữ số: `/35` trong `/api/speaking/exam/sessions/35/turns`. */
    private static final Pattern NUMERIC_SEGMENT = Pattern.compile("/\\d+(?=/|$)");

    /** Đoạn đường dẫn là UUID — chưa route nào dùng, rào sẵn để khỏi lặp lại cùng lỗi. */
    private static final Pattern UUID_SEGMENT = Pattern.compile(
            "/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?=/|$)");

    private final ApiTelemetryService apiTelemetryService;
    private final JwtService jwtService;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return !uri.startsWith("/api/")
                || uri.startsWith("/api/quiz/")
                || uri.startsWith("/api/ws/")
                // Probe bảo trì: mọi client poll 30s trong lúc chờ hết bảo trì — ghi
                // telemetry từng lần poll chỉ là rác đo lường.
                || uri.equals("/api/public/system/status");
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
        // Expose the correlation id to every log line emitted during this request (see
        // logging.pattern.level). Cleared in finally so a pooled thread never leaks it.
        MDC.put("requestId", requestId);

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
                    resolveEndpoint(request),
                    statusCode,
                    latencyMs,
                    isError
            ));
            MDC.remove("requestId");
        }
    }

    /**
     * Ghi MẪU ROUTE thay vì URI thật.
     *
     * Trước 08/09/2026 cột `endpoint` lưu `request.getRequestURI()`, nên mỗi phiên thi sinh ra
     * một "endpoint" riêng: `/api/speaking/exam/sessions/8/turns`, `/…/23/turns`, `/…/35/turns`…
     * Đo trên prod hôm đó thấy 319 trong 443 endpoint khác nhau có chứa số. Hệ quả nặng hơn là
     * mọi báo cáo p95 lọc theo ngưỡng số lượt đều BỎ SÓT chính nhóm chậm nhất: gộp lại thì
     * `/api/speaking/exam/sessions/{id}/turns` có 72 lượt với p50 hơn 3 giây và p95 gần 6,6 giây,
     * nhưng chẻ ra thì không mảnh nào đạt ngưỡng 30 lượt để lọt vào bảng.
     *
     * `BEST_MATCHING_PATTERN_ATTRIBUTE` do DispatcherServlet đặt trong lúc xử lý, nên chỉ đọc được
     * SAU `filterChain.doFilter` — đúng chỗ đang gọi (khối finally). Request không tới được
     * handler (404, hoặc bị Security chặn trước) thì attribute rỗng: khi đó tự che các đoạn số và
     * UUID, vì URI thô của những ca này cũng mang id và làm loãng bảng y hệt.
     */
    private String resolveEndpoint(HttpServletRequest request) {
        Object bestMatch = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        if (bestMatch instanceof String pattern && !pattern.isBlank()) {
            return truncate(pattern);
        }
        return truncate(maskPathVariables(request.getRequestURI()));
    }

    /** Che đoạn định danh trong URI thô — dùng khi không có mẫu route để đọc. */
    static String maskPathVariables(String uri) {
        if (uri == null || uri.isBlank()) {
            return "/";
        }
        String masked = UUID_SEGMENT.matcher(uri).replaceAll("/{uuid}");
        return NUMERIC_SEGMENT.matcher(masked).replaceAll("/{id}");
    }

    private static String truncate(String value) {
        return value.length() <= ENDPOINT_MAX_LEN ? value : value.substring(0, ENDPOINT_MAX_LEN);
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
