package com.deutschflow.user.registration;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Ca IT 10 (công tắc) + job dọn rác. Context riêng: công tắc mã PIN TẮT (mặc định prod hôm nay) và
 * {@code /register} cũ cũng tắt — tổ hợp không có trên prod nhưng cho thử cả hai mã 501 và 410 trong một context.
 */
@SpringBootTest(properties = {
        "app.auth.registration-verification.enabled=false",
        "app.auth.legacy-register.enabled=false"
})
@AutoConfigureMockMvc
@DisplayName("Đăng ký có mã PIN — công tắc + dọn rác")
class RegistrationVerificationSwitchIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PendingRegistrationCleanup cleanup;

    private String body() throws Exception {
        return objectMapper.writeValueAsString(Map.of(
                "email", "switch-" + UUID.randomUUID() + "@test.local",
                "password", "MatKhau123!", "displayName", "Công tắc"));
    }

    @Test
    @DisplayName("10a. công tắc tắt ⇒ /register/start trả 501 DISABLED (client rơi về /register)")
    void switchOff_501() throws Exception {
        mockMvc.perform(post("/api/auth/register/start").contentType(MediaType.APPLICATION_JSON).content(body()))
                .andExpect(status().isNotImplemented())
                .andExpect(jsonPath("$.extensions.reason").value("DISABLED"));
    }

    @Test
    @DisplayName("10b. legacy-register.enabled=false ⇒ /register trả 410")
    void legacyOff_410() throws Exception {
        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(body()))
                .andExpect(status().isGone())
                .andExpect(jsonPath("$.extensions.reason").value("LEGACY_REGISTER_DISABLED"));
    }

    @Test
    @DisplayName("dọn rác chỉ xoá hồ sơ đã đóng / đã hết hạn QUÁ 7 ngày")
    void cleanup_deletesOnlyOldRows() {
        String tag = "cleanup-" + UUID.randomUUID();
        String insert = """
                INSERT INTO pending_registrations
                    (email, password_hash, display_name, code_hash, expires_at, closed_at, closed_reason)
                VALUES (?, 'x', 'x', repeat('0', 64), NOW() + (? || ' days')::interval,
                        CASE WHEN ? THEN NOW() + (? || ' days')::interval END,
                        CASE WHEN ? THEN 'VERIFIED' END)
                """;
        // [email, expiresInDays, closed?, closedDaysAgo(neg)]
        jdbc.update(insert, tag + "-old-closed@x", "-10", true, "-8", true);   // xoá
        jdbc.update(insert, tag + "-new-closed@x", "-10", true, "-2", true);   // giữ (đóng mới 2 ngày)
        jdbc.update(insert, tag + "-old-open@x", "-8", false, "0", false);     // xoá (hết hạn 8 ngày)
        jdbc.update(insert, tag + "-live@x", "1", false, "0", false);          // giữ

        cleanup.purge();

        var left = jdbc.queryForList(
                "SELECT email FROM pending_registrations WHERE email LIKE ? ORDER BY email", String.class, tag + "%");
        assertThat(left).containsExactlyInAnyOrder(tag + "-new-closed@x", tag + "-live@x");
    }
}
