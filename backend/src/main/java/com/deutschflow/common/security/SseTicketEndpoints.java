package com.deutschflow.common.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.util.AntPathMatcher;

import java.util.List;

/**
 * Danh sách DUY NHẤT các endpoint SSE được phép xác thực bằng one-time {@code ?ticket=} (S15).
 *
 * <p>Ticket do {@code POST /api/sse/ticket} phát chỉ để mở {@code EventSource} — API trình duyệt này
 * không gắn được header {@code Authorization} và chỉ gửi GET. Trước 09/11/2026, {@link JwtAuthFilter}
 * nhận ticket trên MỌI method/đường dẫn, nên một ticket lộ (log, Referer) trong 60s đầu dùng được cho cả
 * request ghi. Giờ: chỉ GET tới một trong các mẫu dưới đây; mọi request khác mang {@code ?ticket=} bị bỏ
 * qua ticket (không xác thực từ nó, cũng không tiêu thụ nó).
 *
 * <p>Thêm endpoint SSE mới (method GET, {@code produces = text/event-stream} hoặc trả {@code SseEmitter})
 * mà client cần mở bằng EventSource → thêm mẫu vào {@link #PATTERNS}. Endpoint SSE bằng POST (ví dụ
 * {@code /api/ai-speaking/sessions/{id}/chat/stream}) dùng fetch + Bearer, không bao giờ cần ticket.
 */
public final class SseTicketEndpoints {

    /** Mẫu Ant ({@code *} = đúng một đoạn đường dẫn), tính từ sau context path. */
    static final List<String> PATTERNS = List.of(
            "/api/notifications/stream",                 // UserNotificationController#stream
            "/api/jobs/*/sse",                           // AiJobController#subscribeJobResult
            "/api/async-jobs/*/stream",                  // AsyncJobController#streamJobEvents
            "/api/v2/teacher/materials/jobs/*/sse"       // TeacherMaterialController#subscribeToJob
    );

    private static final AntPathMatcher MATCHER = new AntPathMatcher();

    private SseTicketEndpoints() {
    }

    /** {@code true} khi request là GET tới một endpoint SSE trong danh sách. */
    public static boolean accepts(HttpServletRequest request) {
        if (!"GET".equalsIgnoreCase(request.getMethod())) {
            return false;
        }
        String uri = request.getRequestURI();
        if (uri == null) {
            return false;
        }
        String contextPath = request.getContextPath();
        if (contextPath != null && !contextPath.isEmpty() && uri.startsWith(contextPath)) {
            uri = uri.substring(contextPath.length());
        }
        for (String pattern : PATTERNS) {
            if (MATCHER.match(pattern, uri)) {
                return true;
            }
        }
        return false;
    }
}
