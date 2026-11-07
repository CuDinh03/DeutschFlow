package com.deutschflow.user.tour;

import com.deutschflow.common.exception.BadRequestException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Hướng dẫn lần đầu của từng màn (đợt (e) làm mới Luyện thi, 07/11/2026): học viên đã xem hướng dẫn
 * màn nào. Lưu theo tài khoản; client tự mở hướng dẫn khi khoá màn chưa có trong danh sách.
 */
@Service
@RequiredArgsConstructor
public class UiTourService {

    /** Khoá màn: chữ, số, dấu chấm, gạch nối, gạch dưới; tối đa 40 ký tự. */
    static final Pattern KEY = Pattern.compile("[a-zA-Z0-9._-]{1,40}");
    /** Chặn một tài khoản ghi vô hạn khoá rác. */
    static final int MAX_KEYS = 100;

    private final JdbcTemplate jdbcTemplate;

    @Transactional(readOnly = true)
    public List<String> seen(long userId) {
        return jdbcTemplate.queryForList(
                "SELECT tour_key FROM user_ui_tours WHERE user_id = ? ORDER BY tour_key", String.class, userId);
    }

    /** Đánh dấu đã xem; gọi lại nhiều lần không sao. */
    @Transactional
    public List<String> markSeen(long userId, String key) {
        if (key == null || !KEY.matcher(key).matches()) {
            throw new BadRequestException("Khoá hướng dẫn không hợp lệ.");
        }
        Integer count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM user_ui_tours WHERE user_id = ?", Integer.class, userId);
        if (count != null && count >= MAX_KEYS) {
            throw new BadRequestException("Quá nhiều khoá hướng dẫn.");
        }
        jdbcTemplate.update("""
                INSERT INTO user_ui_tours (user_id, tour_key) VALUES (?, ?)
                ON CONFLICT (user_id, tour_key) DO NOTHING
                """, userId, key);
        return seen(userId);
    }
}
