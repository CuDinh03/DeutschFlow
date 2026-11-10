package com.deutschflow.admin.support;

import org.springframework.util.AntPathMatcher;

import java.util.List;

/**
 * Luật cho request của phiên hỗ trợ chỉ-đọc (dùng ở {@link SupportSessionReadOnlyFilter}).
 *
 * <p>Cho qua: GET / HEAD / OPTIONS, cộng đúng một đường ghi {@code POST /api/support-session/end} (tab hỗ trợ tự
 * kết thúc). Ngay cả với GET, chặn:
 * <ul>
 *   <li>cả không gian quản trị, thanh toán, phát SSE ticket, và {@code /api/auth/**} — trừ GET
 *       {@code /api/auth/me} và {@code /api/auth/me/**} (web đọc hồ sơ/gói/tour lúc mở trang; đường gói đã được
 *       làm thành chỉ-đọc trong phiên hỗ trợ);</li>
 *   <li>các endpoint SSE (luồng dài sống ngoài ThreadLocal của request; web không mở chúng ở chế độ hỗ trợ);</li>
 *   <li>các GET đã rà là có TÁC DỤNG PHỤ: gọi LLM / tiêu token AI, ghi trạng thái học, tạo-khi-đọc, tải file lên
 *       S3, phát URL tải lên, xoá file một-lần, tiêu hạn mức rate-limit.</li>
 * </ul>
 * Một GET ghi dữ liệu mà danh sách này chưa biết vẫn bị lưới chặn DB ({@code SupportReadOnlyDataSource}) chặn
 * và trả 403 cùng mã.
 *
 * <p>Các GET "ghi khi đọc" nhẹ ĐƯỢC làm thành chỉ-đọc thay vì chặn (bỏ bước ghi khi
 * {@code SupportSessionContextHolder.isActive()}): đánh dấu đã đọc thông báo/tin nhắn
 * ({@code NotificationAutoAckService}, {@code MessageService}), đối soát gói ({@code QuotaService.resolvePlanBadge}),
 * trạng thái thích nghi ({@code AdaptivePolicyService}), mở khoá node đầu ({@code SkillTreeService}).
 */
public final class SupportSessionRequestPolicy {

    public static final String END_PATH = "/api/support-session/end";

    private static final AntPathMatcher MATCHER = new AntPathMatcher();

    /** Chặn với MỌI method. */
    static final List<String> DENIED = List.of(
            "/api/admin/**",
            "/api/v2/admin/**",
            "/api/payments/**",
            "/api/sse/**",
            // SSE (SseTicketEndpoints) — luồng dài chạy trên thread khác.
            "/api/notifications/stream",
            "/api/jobs/*/sse",
            "/api/async-jobs/*/stream",
            "/api/v2/teacher/materials/jobs/*/sse",
            // Gọi LLM / tiêu token AI.
            "/api/v2/teacher/classes/*/students/*/comprehensive-report",
            "/api/v2/students/assignments/*/scenario",
            "/api/video-lessons/**",               // listening = LLM + hạn mức; vocab/grammar = TTS + tải S3; vocab/due = ack
            // Ghi trạng thái / tạo-khi-đọc.
            "/api/skill-tree/node/*/session",
            "/api/phase/current",
            "/api/phase/next-action",
            "/api/exam-plan",
            "/api/mock-exams/attempts/me",
            "/api/words/coverage",
            "/api/words/coverage/translation",
            "/api/public/report-issues/*",
            // File: tải lên S3 lần đầu, xoá file tải-một-lần, phát URL tải lên.
            "/api/v2/materials/*/preview",
            "/api/v2/teacher/materials/jobs/*/download",
            "/api/v2/teacher/assignments/presigned-url",
            "/api/v2/students/assignments/presigned-url",
            // Tiêu bucket rate-limit REPORT của người dùng (Redis).
            "/api/ai-speaking/sessions/*/report"
    );

    /** {@code /api/auth/**}: chỉ những GET này được qua. */
    static final List<String> AUTH_READ_ALLOWED = List.of("/api/auth/me", "/api/auth/me/**");

    private SupportSessionRequestPolicy() {
    }

    /** {@code true} khi request (method + đường dẫn đã bỏ context path, không query string) được phép. */
    public static boolean isAllowed(String method, String path) {
        String m = method == null ? "" : method.toUpperCase(java.util.Locale.ROOT);
        String p = normalize(path);
        if ("POST".equals(m) && END_PATH.equals(p)) {
            return true;
        }
        if (!("GET".equals(m) || "HEAD".equals(m) || "OPTIONS".equals(m))) {
            return false;
        }
        if (MATCHER.match("/api/auth/**", p)) {
            return "OPTIONS".equals(m) || matchesAny(AUTH_READ_ALLOWED, p);
        }
        return !matchesAny(DENIED, p);
    }

    /** Đường kết thúc phiên — chạy NGOÀI lưới READ ONLY của DB (cần UPDATE phiên). */
    public static boolean isEndRequest(String method, String path) {
        return "POST".equalsIgnoreCase(method) && END_PATH.equals(normalize(path));
    }

    static String normalize(String path) {
        if (path == null || path.isEmpty()) {
            return "/";
        }
        String p = path;
        int q = p.indexOf('?');
        if (q >= 0) {
            p = p.substring(0, q);
        }
        // Matrix/path parameter (";x") trong từng đoạn — Spring MVC bỏ qua chúng khi định tuyến.
        p = p.replaceAll(";[^/]*", "");
        while (p.contains("//")) {
            p = p.replace("//", "/");
        }
        while (p.length() > 1 && p.endsWith("/")) {
            p = p.substring(0, p.length() - 1);
        }
        return p;
    }

    private static boolean matchesAny(List<String> patterns, String path) {
        for (String pattern : patterns) {
            if (MATCHER.match(pattern, path)) {
                return true;
            }
        }
        return false;
    }
}
