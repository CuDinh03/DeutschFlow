package com.deutschflow.user.registration;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Logic dọn {@code pending_registrations}, tách khỏi bean lịch ({@link PendingRegistrationCleanupJob}) để
 * gọi qua proxy và test được riêng.
 *
 * <p>Xoá hồ sơ đã đóng, hoặc chưa đóng mà đã hết hạn, QUÁ 7 ngày. Giữ 7 ngày để kịp đo phễu
 * gửi mã → xác minh; sau đó xoá hẳn vì bảng giữ mật khẩu băm (và IP) của người chưa thành người dùng.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PendingRegistrationCleanup {

    static final int RETENTION_DAYS = 7;

    private final JdbcTemplate jdbc;

    public int purge() {
        int n = jdbc.update("""
                DELETE FROM pending_registrations
                WHERE COALESCE(closed_at, expires_at) < NOW() - make_interval(days => ?)
                """, RETENTION_DAYS);
        if (n > 0) log.info("[Registration] đã xoá {} hồ sơ đăng ký chờ cũ", n);
        return n;
    }
}
