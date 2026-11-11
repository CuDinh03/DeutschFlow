package com.deutschflow.teacher.controller;

import com.deutschflow.common.exception.NotFoundException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Cờ tắt tính năng "buổi học 1:1" ({@link TeacherSessionController}, {@code /api/teacher-sessions/**}).
 *
 * <p>Tính năng tạm tắt từ 11/2026 (cấu hình {@code app.features.teacher-sessions-enabled}, mặc định
 * {@code false}) cho tới khi buổi học được gắn với giao dịch thanh toán. Khi tắt, mọi endpoint của
 * tính năng trả 404 như thể không tồn tại — kể cả với người gọi không đủ vai trò, vì interceptor
 * chạy trước {@code @PreAuthorize}. Người chưa đăng nhập vẫn nhận 401 từ filter bảo mật như cũ.
 *
 * <p>Chặn theo ĐƯỜNG DẪN chứ không gỡ bean: {@code TeacherSessionService} và repository vẫn được
 * các nơi khác dùng (ví dụ xoá tài khoản), nên không dùng {@code @ConditionalOnProperty}. Phạm vi chỉ
 * là buổi học 1:1 — buổi dạy của lớp, lịch lớp và bảng công nằm ở đường dẫn khác, không bị ảnh hưởng.
 */
public class TeacherSessionsFeatureInterceptor implements HandlerInterceptor {

    /** Mọi đường dẫn của tính năng — dùng khi đăng ký interceptor. */
    public static final String[] PATH_PATTERNS = {"/api/teacher-sessions", "/api/teacher-sessions/**"};

    private final boolean enabled;

    public TeacherSessionsFeatureInterceptor(boolean enabled) {
        this.enabled = enabled;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!enabled) {
            throw new NotFoundException("Không tìm thấy tài nguyên");
        }
        return true;
    }
}
