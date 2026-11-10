package com.deutschflow.admin.support;

import com.deutschflow.common.audit.AuditActor;
import com.deutschflow.common.audit.AuditLogService;
import com.deutschflow.common.audit.AuditOrgResolver;
import com.deutschflow.common.security.support.SupportSessionContext;
import com.deutschflow.common.security.support.SupportSessionDbGuard;
import com.deutschflow.common.security.support.SupportSessionReadOnlyException;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.UrlPathHelper;

import java.io.IOException;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Bộ lọc CHỈ-ĐỌC của phiên hỗ trợ — đứng ngay sau {@code JwtAuthFilter} trong security chain (SecurityConfig).
 * Chỉ hoạt động khi request mang {@link SupportSessionContext} (token {@code typ=support} đã được xác minh).
 *
 * <ol>
 *   <li>Request không được {@link SupportSessionRequestPolicy} cho phép → 403 problem+json
 *       {@code extensions.code=SUPPORT_SESSION_READ_ONLY}, không đi tiếp chain. Vết
 *       {@code support_session.write_denied} ghi TỐI ĐA một lần cho mỗi (phiên, method + đường dẫn) — tập nhớ
 *       trong bộ nhớ, đủ dài để phủ một phiên 30 phút.</li>
 *   <li>Request được phép → chạy chain trong {@link SupportSessionDbGuard} (mọi connection DB lấy ra là READ ONLY
 *       ở phía PostgreSQL), TRỪ {@code POST /api/support-session/end} (cần UPDATE phiên).</li>
 *   <li>{@code finally}: tắt cờ READ ONLY rồi mới ghi một dòng {@code admin_support_session_events} (method,
 *       đường dẫn không query string, status).</li>
 * </ol>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SupportSessionReadOnlyFilter extends OncePerRequestFilter {

    private static final UrlPathHelper PATHS = new UrlPathHelper();

    private final SupportSessionStore store;
    private final AuditLogService auditLogService;
    private final AuditOrgResolver auditOrgResolver;

    /** Khoá "sessionId|METHOD path" đã ghi vết từ chối — sống lâu hơn một phiên (30 phút). */
    private final Cache<String, Boolean> deniedOnce = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofMinutes(40))
            .maximumSize(20_000)
            .build();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if (!(request.getAttribute(SupportSessionContext.REQUEST_ATTRIBUTE) instanceof SupportSessionContext ctx)) {
            filterChain.doFilter(request, response);
            return;
        }
        String method = request.getMethod();
        String path = SupportSessionRequestPolicy.normalize(PATHS.getPathWithinApplication(request));

        if (!SupportSessionRequestPolicy.isAllowed(method, path)) {
            auditDeniedOnce(ctx, method, path);
            writeReadOnly(request, response);
            recordEvent(ctx, method, path, HttpServletResponse.SC_FORBIDDEN);
            return;
        }

        boolean guard = !SupportSessionRequestPolicy.isEndRequest(method, path);
        int status = HttpServletResponse.SC_INTERNAL_SERVER_ERROR;
        try {
            if (guard) {
                SupportSessionDbGuard.enter();
            }
            filterChain.doFilter(request, response);
            status = response.getStatus();
        } finally {
            SupportSessionDbGuard.exit();
            recordEvent(ctx, method, path, status);
        }
    }

    private void auditDeniedOnce(SupportSessionContext ctx, String method, String path) {
        String key = ctx.sessionId() + "|" + method + " " + path;
        if (deniedOnce.asMap().putIfAbsent(key, Boolean.TRUE) != null) {
            return;
        }
        try {
            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("sessionId", ctx.sessionId());
            meta.put("method", method);
            meta.put("path", path);
            // actor/subject do AuditLogService làm giàu từ SupportSessionContextHolder (admin là actor).
            auditLogService.log(SupportSessionService.EVENT_WRITE_DENIED,
                    new AuditActor(ctx.adminUserId(), ctx.adminEmail(), "ADMIN"),
                    "USER", String.valueOf(ctx.targetUserId()),
                    auditOrgResolver.forUser(ctx.targetUserId()), meta);
        } catch (RuntimeException e) {
            log.warn("[SupportSession] Không ghi được vết write_denied phiên {}: {}", ctx.sessionId(), e.getMessage());
        }
    }

    private void recordEvent(SupportSessionContext ctx, String method, String path, int status) {
        try {
            store.insertEvent(ctx.sessionId(), method, path, status);
        } catch (RuntimeException e) {
            log.warn("[SupportSession] Không ghi được sự kiện phiên {} ({} {}): {}",
                    ctx.sessionId(), method, path, e.getMessage());
        }
    }

    private static void writeReadOnly(HttpServletRequest request, HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setCharacterEncoding("UTF-8");
        response.setContentType("application/problem+json");
        String instance = request.getRequestURI() == null ? "" : request.getRequestURI()
                .replace("\\", "\\\\").replace("\"", "\\\"");
        response.getWriter().write("{\"type\":\"https://deutschflow.com/errors/support-session-read-only\","
                + "\"title\":\"Forbidden\",\"status\":403,"
                + "\"detail\":\"Chế độ hỗ trợ chỉ đọc — không thực hiện được thao tác này.\","
                + "\"instance\":\"" + instance + "\",\"extensions\":{\"code\":\""
                + SupportSessionReadOnlyException.CODE + "\"}}");
    }
}
