package com.deutschflow.user.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * "Hoạt động bảo mật" của chính người dùng (đợt 2 admin, 09/11/2026) —
 * {@code GET /api/profile/me/security-events}.
 *
 * <p>Đọc {@code audit_logs} có ĐỐI TƯỢNG là chính người gọi ({@code target_type = 'USER' AND
 * target_id = <mình>}), chỉ trong danh sách trắng {@link #EVENTS}. Mục đích: người dùng thấy được
 * "mật khẩu của tôi vừa bị đổi / tài khoản vừa bị khoá" mà không cần hỏi hỗ trợ.
 *
 * <p>⛔ Chỉ trả {@code event} + {@code occurredAt}. KHÔNG actor (email admin), KHÔNG lý do, KHÔNG
 * metadata — audit_logs là sổ nội bộ; lý do và danh tính người thao tác ở lại phía admin.
 */
@Service
@RequiredArgsConstructor
public class UserSecurityEventsService {

    private static final int MAX_PAGE_SIZE = 50;

    /**
     * Danh sách trắng. Thêm loại mới ở đây = phơi nó cho người dùng, nên chỉ thêm vết mà metadata
     * KHÔNG cần để hiểu (nhãn đủ nghĩa). Năm tên cuối chưa có nơi ghi — giữ sẵn để khi phiên hỗ trợ
     * và MFA lên thì tự hiện mà không phải sửa đường đọc.
     */
    public static final List<String> EVENTS = List.of(
            "user.password.changed",
            "user.password.reset",
            "admin.user.password.reset",
            "admin.user.deactivated",
            "admin.user.reactivated",
            "support_session.started",
            "support_session.ended",
            "user.mfa.enabled",
            "user.mfa.recovery_used",
            "admin.user.mfa.reset");

    private final JdbcTemplate jdbcTemplate;

    public record SecurityEvent(String event, Instant occurredAt) {}

    public Map<String, Object> list(Long userId, int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);

        String placeholders = String.join(",", java.util.Collections.nCopies(EVENTS.size(), "?"));
        String where = " WHERE target_type = 'USER' AND target_id = ? AND event_name IN (" + placeholders + ")";
        List<Object> args = new ArrayList<>();
        args.add(String.valueOf(userId));
        args.addAll(EVENTS);

        Long total = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM audit_logs" + where, Long.class, args.toArray());

        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(safeSize);
        pageArgs.add((long) safePage * safeSize);
        List<SecurityEvent> items = jdbcTemplate.query(
                "SELECT event_name, created_at FROM audit_logs" + where
                        + " ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
                (rs, rowNum) -> {
                    Timestamp ts = rs.getTimestamp("created_at");
                    return new SecurityEvent(rs.getString("event_name"), ts != null ? ts.toInstant() : null);
                },
                pageArgs.toArray());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", items);
        out.put("total", total != null ? total : 0L);
        out.put("page", safePage);
        out.put("size", safeSize);
        return out;
    }
}
