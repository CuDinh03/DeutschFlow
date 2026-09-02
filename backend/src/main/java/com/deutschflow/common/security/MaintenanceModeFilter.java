package com.deutschflow.common.security;

import com.deutschflow.common.exception.GlobalExceptionHandler;
import com.deutschflow.system.entity.MaintenanceWindow;
import com.deutschflow.system.service.MaintenanceStateService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Tầng B của cơ chế bảo trì (plans/2026-09-03): khi có window ACTIVE mode FULL,
 * trả 503 {@code application/problem+json} với {@code extensions.code=MAINTENANCE}
 * cho mọi request TRỪ whitelist bên dưới. Đăng ký trong security chain SAU
 * {@link JwtAuthFilter} (SecurityConfig) để đọc được role — admin bypass toàn phần.
 *
 * <p>Whitelist (xem thiết kế §5.2): {@code /api/public/**} (probe status phải luôn
 * trả lời), login+refresh (admin còn đường vào), {@code /api/admin/**} (admin phải
 * TẮT được bảo trì qua UI — role-gate riêng đã có), mọi URI ngoài {@code /api/}
 * (actuator = readiness blue-green, cấm đụng), và OPTIONS (preflight chết là web
 * mù, không phân biệt được bảo trì với mất mạng).
 *
 * <p>Chặn CẢ webhook thanh toán {@code /api/payments/**} — chủ đích: đang migrate
 * DB mà nhận webhook ghi dữ liệu là rủi ro hỏng dữ liệu; Stripe/MoMo/Apple/SePay
 * đều retry theo backoff khi gặp 503.
 *
 * <p>Exception từ filter KHÔNG qua {@code GlobalExceptionHandler} nên body tự ghi
 * bằng Jackson (escape note admin nhập) + charset UTF-8 tường minh (thiếu là
 * tiếng Việt thành mojibake — tiền lệ {@code PublicApiRateLimitFilter}).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MaintenanceModeFilter extends OncePerRequestFilter {

    private static final int RETRY_AFTER_DEFAULT_SECONDS = 300;
    private static final int RETRY_AFTER_MIN_SECONDS = 60;
    private static final int RETRY_AFTER_MAX_SECONDS = 3600;

    private final MaintenanceStateService maintenanceStateService;
    private final ObjectMapper objectMapper;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String uri = request.getRequestURI();
        return !uri.startsWith("/api/")
                || uri.startsWith("/api/public/")
                || uri.startsWith("/api/admin/")
                || uri.equals("/api/auth/login")
                || uri.equals("/api/auth/refresh");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        MaintenanceWindow active = maintenanceStateService.activeFullWindow().orElse(null);
        if (active == null || isAdmin()) {
            filterChain.doFilter(request, response);
            return;
        }
        writeMaintenanceResponse(response, request.getRequestURI(), active);
    }

    private boolean isAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            return false;
        }
        return auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    }

    private void writeMaintenanceResponse(HttpServletResponse response,
                                          String requestUri,
                                          MaintenanceWindow window) throws IOException {
        long retryAfter = retryAfterSeconds(window);

        String detail = window.getEndsAt() != null
                ? "Hệ thống đang bảo trì, dự kiến hoạt động lại lúc "
                        + MaintenanceStateService.displayVn(window.getEndsAt()) + "."
                : "Hệ thống đang bảo trì, vui lòng quay lại sau ít phút.";

        Map<String, Object> extensions = new LinkedHashMap<>();
        extensions.put("code", "MAINTENANCE");
        extensions.put("windowId", window.getId());
        extensions.put("title", window.getTitle());
        if (window.getNote() != null && !window.getNote().isBlank()) {
            extensions.put("note", window.getNote());
        }
        extensions.put("startsAtUtc", window.getStartsAt().toInstant(ZoneOffset.UTC).toString());
        if (window.getEndsAt() != null) {
            extensions.put("endsAtUtc", window.getEndsAt().toInstant(ZoneOffset.UTC).toString());
        }
        extensions.put("retryAfterSeconds", retryAfter);

        var body = new GlobalExceptionHandler.ProblemDetail(
                "https://deutschflow.com/errors/maintenance",
                "Service Under Maintenance",
                HttpServletResponse.SC_SERVICE_UNAVAILABLE,
                detail,
                requestUri,
                LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME),
                null,
                extensions
        );

        response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
        response.setHeader("Retry-After", String.valueOf(retryAfter));
        // Client (web/mobile) nhận diện bảo trì qua header này kể cả khi không parse được body.
        response.setHeader("X-DF-Maintenance", "1");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType("application/problem+json");
        response.getOutputStream().write(objectMapper.writeValueAsBytes(body));
    }

    /** Giây còn lại tới ends_at, kẹp [60, 3600]; không rõ giờ xong → 300. */
    private static long retryAfterSeconds(MaintenanceWindow window) {
        if (window.getEndsAt() == null) {
            return RETRY_AFTER_DEFAULT_SECONDS;
        }
        long remaining = Duration.between(LocalDateTime.now(ZoneOffset.UTC), window.getEndsAt()).getSeconds();
        return Math.max(RETRY_AFTER_MIN_SECONDS, Math.min(RETRY_AFTER_MAX_SECONDS, remaining));
    }
}
