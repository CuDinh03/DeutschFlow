package com.deutschflow.user.tour;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Hướng dẫn lần đầu đã xem (V364) trên PostgreSQL thật. */
@SpringBootTest
@DisplayName("Hướng dẫn lần đầu đã xem (UiTourService) trên Postgres")
class UiTourServiceIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final long UID = 990_364L;

    @Autowired private UiTourService service;
    @Autowired private JdbcTemplate jdbc;

    @BeforeEach
    void setUp() {
        jdbc.update("""
            INSERT INTO users (id, email, password_hash, display_name, role, created_at)
            VALUES (?, ?, 'x', 'Test hướng dẫn', 'STUDENT', NOW())
            ON CONFLICT (id) DO NOTHING
            """, UID, "ui-tour-" + UID + "@test.local");
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("DELETE FROM user_ui_tours WHERE user_id = ?", UID);
        jdbc.update("DELETE FROM users WHERE id = ?", UID);
    }

    @Test
    @DisplayName("Đánh dấu đã xem, gọi lại không nhân đôi, đọc lại theo thứ tự khoá")
    void markSeen_idempotent() {
        assertThat(service.seen(UID)).isEmpty();
        service.markSeen(UID, "exam.today");
        service.markSeen(UID, "exam.today");
        assertThat(service.markSeen(UID, "exam.mockStart")).containsExactly("exam.mockStart", "exam.today");
    }

    @Test
    @DisplayName("Khoá sai định dạng bị từ chối")
    void badKey() {
        assertThatThrownBy(() -> service.markSeen(UID, "x".repeat(41))).isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("Xoá người dùng xoá luôn hướng dẫn đã xem")
    void cascade() {
        service.markSeen(UID, "exam.today");
        jdbc.update("DELETE FROM users WHERE id = ?", UID);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM user_ui_tours WHERE user_id = ?", Integer.class, UID)).isZero();
    }
}
