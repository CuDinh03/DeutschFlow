package com.deutschflow.admin;

import com.deutschflow.notification.service.NotificationOutboxService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Đợt 2 admin (09/11/2026) — {@code PATCH /api/admin/users/{id}/password}:
 * <ul>
 *   <li>mục tiêu là ADMIN (kể cả chính mình) → 403 {@code ADMIN_PASSWORD_RESET_FORBIDDEN}, mật khẩu
 *       không đổi, có vết {@code admin.user.password.reset.blocked} (sống sót dù service rollback);</li>
 *   <li>mục tiêu thường → 200, push token bị xoá, có một dòng outbox {@code PASSWORD_RESET_BY_ADMIN}
 *       cho đúng người đó, và cả outbox lẫn thông báo đã gửi KHÔNG mang lý do hay email admin.</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Admin · đặt lại mật khẩu: chặn tài khoản ADMIN + báo người bị đổi")
class AdminPasswordResetGuardIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String REASON = "Học viên mất quyền truy cập hộp thư cũ";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private NotificationOutboxService outboxService;

    private User admin;
    private User otherAdmin;
    private User student;

    @BeforeEach
    void seed() {
        admin = account("pwg-admin", User.Role.ADMIN);
        otherAdmin = account("pwg-admin2", User.Role.ADMIN);
        student = account("pwg-student", User.Role.STUDENT);
        jdbcTemplate.update("UPDATE users SET push_token = 'ExponentPushToken[pwg]', push_platform = 'ios' WHERE id = ?",
                student.getId());
    }

    @Test
    @DisplayName("ADMIN khác → 403 + mã, mật khẩu không đổi, có vết bị chặn, không thông báo")
    void otherAdmin_isForbidden() throws Exception {
        String hashBefore = hashOf(otherAdmin.getId());

        reset(otherAdmin)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.extensions.code").value("ADMIN_PASSWORD_RESET_FORBIDDEN"));

        assertThat(hashOf(otherAdmin.getId())).isEqualTo(hashBefore);
        assertThat(traces("admin.user.password.reset.blocked", otherAdmin.getId())).isEqualTo(1);
        assertThat(traces("admin.user.password.reset", otherAdmin.getId())).isZero();
        assertThat(outboxRows(otherAdmin.getId())).isEmpty();
    }

    @Test
    @DisplayName("chính mình (ADMIN) → 403 — admin tự đặt lại qua Quên mật khẩu")
    void self_isForbidden() throws Exception {
        reset(admin)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.extensions.code").value("ADMIN_PASSWORD_RESET_FORBIDDEN"));
    }

    @Test
    @DisplayName("học viên → 200, push token bị xoá, outbox báo đúng người, không lộ lý do/admin")
    void student_isResetAndNotified() throws Exception {
        String hashBefore = hashOf(student.getId());

        reset(student).andExpect(status().isOk());

        assertThat(hashOf(student.getId())).isNotEqualTo(hashBefore);
        assertThat(jdbcTemplate.queryForObject("SELECT push_token FROM users WHERE id = ?", String.class,
                student.getId())).isNull();
        assertThat(traces("admin.user.password.reset", student.getId())).isEqualTo(1);

        List<Map<String, Object>> rows = outboxRows(student.getId());
        assertThat(rows).hasSize(1);
        String payload = String.valueOf(rows.get(0).get("payload"));
        assertThat(payload).contains("resetAt").doesNotContain(REASON).doesNotContain(admin.getEmail());

        // Worker giao thông báo — ở đây gọi thẳng như IT outbox khác (scheduler không chạy trong test).
        outboxService.deliver(((Number) rows.get(0).get("id")).longValue());
        String delivered = jdbcTemplate.queryForObject("""
                SELECT payload_json::text FROM user_notifications
                WHERE recipient_user_id = ? AND notification_type = 'PASSWORD_RESET_BY_ADMIN'
                """, String.class, student.getId());
        assertThat(delivered).doesNotContain(REASON).doesNotContain(admin.getEmail());
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private ResultActions reset(User target) throws Exception {
        return mockMvc.perform(patch("/api/admin/users/{userId}/password", target.getId())
                .with(user(admin))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "password", "PwGuard-" + UUID.randomUUID(),
                        "reason", REASON))));
    }

    private String hashOf(Long id) {
        return jdbcTemplate.queryForObject("SELECT password_hash FROM users WHERE id = ?", String.class, id);
    }

    private long traces(String event, Long targetId) {
        Long n = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM audit_logs WHERE event_name = ? AND target_type = 'USER' AND target_id = ?",
                Long.class, event, String.valueOf(targetId));
        return n == null ? 0 : n;
    }

    private List<Map<String, Object>> outboxRows(Long recipientId) {
        return jdbcTemplate.queryForList("""
                SELECT id, payload::text AS payload FROM notification_outbox
                WHERE recipient_id = ? AND notification_type = 'PASSWORD_RESET_BY_ADMIN'
                """, recipientId);
    }

    private User account(String local, User.Role role) {
        User u = User.builder()
                .email(local + "-" + UUID.randomUUID().toString().substring(0, 6) + "@test.local")
                .passwordHash("x")
                .displayName("PWG " + local)
                .role(role)
                .build();
        u.setActive(true);
        return userRepository.save(u);
    }
}
