package com.deutschflow.admin.support;

import com.deutschflow.common.security.JwtService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.RefreshToken;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.RefreshTokenRepository;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Phiên hỗ trợ chỉ-đọc đầu-cuối trên PostgreSQL thật (V370): admin (đã qua 2FA) mở phiên → tab mới đổi mã + cookie
 * refresh của admin lấy token support → GET như người dùng 200 → POST 403 → GET "ghi khi đọc" (controller chỉ có
 * trong test) bị lưới READ ONLY của DB chặn, cả autocommit lẫn JPA sau một transaction readOnly → connection trả về
 * pool KHÔNG còn READ ONLY (pool 3 connection, request thường ghi được ngay sau) → kết thúc → token 401 ngay
 * (cache bị xoá) → vết + nhật ký request có mặt.
 */
@SpringBootTest(properties = {
        "app.security.admin-mfa.enforced=true",
        "app.security.support-session.enabled=true",
        // Pool nhỏ (Hikari ưu tiên trả lại connection thread này vừa dùng): request thường ngay sau gần như chắc chắn
        // mượn lại đúng connection vật lý vừa phục vụ phiên hỗ trợ.
        "spring.datasource.hikari.maximum-pool-size=3",
        "spring.datasource.hikari.minimum-idle=1"
})
// Context riêng (property + @Import) ⇒ đóng sau lớp để không giữ pool tới hết lượt CI ("too many clients").
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@AutoConfigureMockMvc
@Import(SupportSessionFlowIntegrationTest.WritingGetController.class)
@DisplayName("Phiên hỗ trợ chỉ-đọc — Integration")
class SupportSessionFlowIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String REASON = "Người dùng báo không thấy bài tập tuần này";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private UserRepository userRepository;
    @Autowired private RefreshTokenRepository refreshTokenRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;

    /** GET có tác dụng phụ — chỉ tồn tại trong test, mô phỏng một handler "ghi khi đọc" chưa có trong danh sách chặn. */
    @RestController
    static class WritingGetController {
        private final JdbcTemplate jdbc;
        private final PlatformTransactionManager tm;
        private final UserRepository users;

        WritingGetController(JdbcTemplate jdbc, PlatformTransactionManager tm, UserRepository users) {
            this.jdbc = jdbc;
            this.tm = tm;
            this.users = users;
        }

        @GetMapping("/api/test-support/write-autocommit")
        Map<String, Object> writeAutocommit(@AuthenticationPrincipal User u) {
            return Map.of("updated", jdbc.update("UPDATE users SET display_name = display_name WHERE id = ?", u.getId()));
        }

        @GetMapping("/api/test-support/write-jpa-after-readonly-tx")
        Map<String, Object> writeJpaAfterReadOnlyTx(@AuthenticationPrincipal User u) {
            TransactionTemplate ro = new TransactionTemplate(tm);
            ro.setReadOnly(true);
            ro.execute(s -> jdbc.queryForObject("SELECT 1", Integer.class));
            new TransactionTemplate(tm).executeWithoutResult(s -> {
                User managed = users.findById(u.getId()).orElseThrow();
                managed.setDisplayName(managed.getDisplayName() + " (đã sửa)");
                users.saveAndFlush(managed);
            });
            return Map.of("updated", 1);
        }

        @GetMapping("/api/test-support/db-session-state")
        Map<String, Object> state() {
            return Map.of("defaultReadOnly", jdbc.queryForObject("SHOW default_transaction_read_only", String.class));
        }
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private User newUser(User.Role role, boolean active) {
        return userRepository.save(User.builder()
                .email("support-it-" + UUID.randomUUID() + "@test.local")
                .passwordHash(passwordEncoder.encode("MatKhau123!"))
                .displayName("IT " + role)
                .role(role)
                .locale(User.Locale.vi)
                .active(active)
                .build());
    }

    private String adminAccessToken(User admin) {
        return jwtService.generateAccessToken(admin, null, null, Instant.now());
    }

    private String adminRefreshToken(User admin, Instant mfaVerifiedAt) {
        String token = UUID.randomUUID().toString();
        refreshTokenRepository.save(RefreshToken.builder().user(admin).token(token)
                .expiresAt(LocalDateTime.now().plusDays(1)).mfaVerifiedAt(mfaVerifiedAt).build());
        return token;
    }

    private JsonNode json(MvcResult r) throws Exception {
        return objectMapper.readTree(r.getResponse().getContentAsString());
    }

    private JsonNode start(User admin, User target) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/admin/users/" + target.getId() + "/support-session")
                        .header("Authorization", "Bearer " + adminAccessToken(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", REASON))))
                .andExpect(status().isCreated())
                .andReturn();
        return json(r);
    }

    private MvcResult redeem(String code, String refreshCookie) throws Exception {
        var req = post("/api/auth/support-session/redeem")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("code", code)));
        if (refreshCookie != null) {
            req = req.cookie(new Cookie("refresh_token", refreshCookie));
        }
        return mockMvc.perform(req).andReturn();
    }

    private int countAudit(String event, long targetId) {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE event_name = ? AND target_type = 'USER' "
                + "AND target_id = ?", Integer.class, event, String.valueOf(targetId));
        return n == null ? 0 : n;
    }

    // ─── tests ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("luồng đầy đủ: mở → đổi mã → đọc 200 → ghi 403 → lưới DB chặn GET ghi → pool sạch → kết thúc → 401")
    void fullFlow() throws Exception {
        User admin = newUser(User.Role.ADMIN, true);
        User student = newUser(User.Role.STUDENT, true);
        String refresh = adminRefreshToken(admin, Instant.now());

        JsonNode started = start(admin, student);
        long sessionId = started.get("sessionId").asLong();
        String code = started.get("handoffCode").asText();
        assertThat(jdbc.queryForObject("SELECT handoff_code_hash FROM admin_support_sessions WHERE id = ?",
                String.class, sessionId)).isNotEqualTo(code).hasSize(64);

        // Mở lại khi đang có phiên mở → phiên đầu bị đóng (replaced); dùng phiên thứ hai.
        JsonNode second = start(admin, student); // mở lại: phiên đầu bị replaced
        assertThat(jdbc.queryForObject("SELECT end_reason FROM admin_support_sessions WHERE id = ?", String.class,
                sessionId)).isEqualTo("replaced");
        sessionId = second.get("sessionId").asLong();
        code = second.get("handoffCode").asText();

        MvcResult redeemed = redeem(code, refresh);
        assertThat(redeemed.getResponse().getStatus()).isEqualTo(200);
        assertThat(redeemed.getResponse().getHeader("Cache-Control")).contains("no-store");
        String supportToken = json(redeemed).get("accessToken").asText();
        assertThat(json(redeemed).at("/session/role").asText()).isEqualTo("STUDENT");
        // Dùng một lần.
        assertThat(redeem(code, refresh).getResponse().getStatus()).isEqualTo(400);

        // Đọc như người dùng.
        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + supportToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(student.getEmail()));

        // Ghi → 403 SUPPORT_SESSION_READ_ONLY (hai lần, vết write_denied chỉ một).
        for (int i = 0; i < 2; i++) {
            mockMvc.perform(post("/api/notifications/read-all").header("Authorization", "Bearer " + supportToken))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.extensions.code").value("SUPPORT_SESSION_READ_ONLY"));
        }
        // Không gian quản trị → 403 dù là GET.
        mockMvc.perform(get("/api/admin/users").header("Authorization", "Bearer " + supportToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.extensions.code").value("SUPPORT_SESSION_READ_ONLY"));

        // Lưới DB: phiên PostgreSQL của request hỗ trợ đang READ ONLY…
        mockMvc.perform(get("/api/test-support/db-session-state").header("Authorization", "Bearer " + supportToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.defaultReadOnly").value("on"));
        // …nên GET ghi bị PostgreSQL từ chối (25006) → 403 cùng mã; dữ liệu không đổi.
        String nameBefore = student.getDisplayName();
        mockMvc.perform(get("/api/test-support/write-autocommit").header("Authorization", "Bearer " + supportToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.extensions.code").value("SUPPORT_SESSION_READ_ONLY"));
        mockMvc.perform(get("/api/test-support/write-jpa-after-readonly-tx")
                        .header("Authorization", "Bearer " + supportToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.extensions.code").value("SUPPORT_SESSION_READ_ONLY"));
        assertThat(userRepository.findById(student.getId()).orElseThrow().getDisplayName()).isEqualTo(nameBefore);

        // Connection trả về pool sạch: request thường (admin) ghi được, phiên DB không còn READ ONLY.
        String adminToken = adminAccessToken(admin);
        for (int i = 0; i < 4; i++) {
            mockMvc.perform(get("/api/test-support/db-session-state").header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.defaultReadOnly").value("off"));
            mockMvc.perform(get("/api/test-support/write-autocommit").header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.updated").value(1));
            mockMvc.perform(get("/api/test-support/write-jpa-after-readonly-tx")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk());
        }

        // Kết thúc từ tab hỗ trợ → token chết ngay (cache bị xoá trên node này).
        mockMvc.perform(post("/api/support-session/end").header("Authorization", "Bearer " + supportToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ended").value(true));
        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + supportToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.extensions.code").value("SUPPORT_SESSION_ENDED"));

        // Vết + nhật ký request.
        assertThat(countAudit("support_session.started", student.getId())).isEqualTo(2);
        assertThat(countAudit("support_session.ended", student.getId())).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE event_name = 'support_session.write_denied' "
                + "AND target_id = ? AND metadata_json::text LIKE '%read-all%'", Integer.class,
                String.valueOf(student.getId()))).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT actor_user_id FROM audit_logs WHERE event_name = 'support_session.write_denied' "
                + "AND target_id = ? LIMIT 1", Long.class, String.valueOf(student.getId()))).isEqualTo(admin.getId());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM admin_support_session_events WHERE session_id = ?",
                Integer.class, sessionId)).isGreaterThanOrEqualTo(7);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM admin_support_session_events WHERE session_id = ? "
                + "AND path LIKE '%?%'", Integer.class, sessionId)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM user_notifications WHERE recipient_user_id = ? "
                + "AND notification_type = 'ADMIN_SUPPORT_VIEW'", Integer.class, student.getId())).isEqualTo(2);
    }

    @Test
    @DisplayName("cookie refresh không có mfa_verified_at → 400 SUPPORT_HANDOFF_INVALID")
    void redeemNeedsMfaVerifiedRefresh() throws Exception {
        User admin = newUser(User.Role.ADMIN, true);
        User student = newUser(User.Role.STUDENT, true);
        String code = start(admin, student).get("handoffCode").asText();
        MvcResult r = redeem(code, adminRefreshToken(admin, null));
        assertThat(r.getResponse().getStatus()).isEqualTo(400);
        assertThat(json(r).at("/extensions/code").asText()).isEqualTo("SUPPORT_HANDOFF_INVALID");
    }

    @Test
    @DisplayName("người không phải ADMIN không mở được phiên (403); đích ADMIN → 403 SUPPORT_TARGET_FORBIDDEN")
    void startRules() throws Exception {
        User admin = newUser(User.Role.ADMIN, true);
        User teacher = newUser(User.Role.TEACHER, true);
        User otherAdmin = newUser(User.Role.ADMIN, true);
        User student = newUser(User.Role.STUDENT, true);

        mockMvc.perform(post("/api/admin/users/" + student.getId() + "/support-session")
                        .header("Authorization", "Bearer " + jwtService.generateAccessToken(teacher))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", REASON))))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/admin/users/" + otherAdmin.getId() + "/support-session")
                        .header("Authorization", "Bearer " + adminAccessToken(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", REASON))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.extensions.code").value("SUPPORT_TARGET_FORBIDDEN"));
    }

    @Test
    @DisplayName("admin đăng xuất → phiên hỗ trợ đóng (admin_logout), token support 401")
    void adminLogoutEndsSession() throws Exception {
        User admin = newUser(User.Role.ADMIN, true);
        User student = newUser(User.Role.STUDENT, true);
        String refresh = adminRefreshToken(admin, Instant.now());
        JsonNode started = start(admin, student);
        String supportToken = json(redeem(started.get("handoffCode").asText(), refresh)).get("accessToken").asText();

        mockMvc.perform(post("/api/auth/logout").header("Authorization", "Bearer " + adminAccessToken(admin)))
                .andExpect(status().is2xxSuccessful());

        assertThat(jdbc.queryForObject("SELECT end_reason FROM admin_support_sessions WHERE id = ?", String.class,
                started.get("sessionId").asLong())).isEqualTo("admin_logout");
        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + supportToken))
                .andExpect(status().isUnauthorized());
    }
}
