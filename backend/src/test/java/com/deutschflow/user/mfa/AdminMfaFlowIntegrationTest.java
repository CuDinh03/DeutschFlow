package com.deutschflow.user.mfa;

import com.deutschflow.common.mail.TransactionalMail;
import com.deutschflow.common.security.JwtService;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 2FA ADMIN đầu-cuối trên PostgreSQL thật (V369): đăng nhập → mã email → bắt đầu đăng ký → xác nhận TOTP → 10 mã
 * khôi phục → đăng nhập lại bằng TOTP (chống phát lại) và bằng mã khôi phục (dùng một lần) → refresh chép/đòi
 * {@code mfa_verified_at} → admin khác đặt lại, tự đặt lại bị cấm.
 *
 * <p>Thư bắt qua {@link TransactionalMail} giả; mã email đọc từ TIÊU ĐỀ thư. Không {@code @Transactional} trên
 * lớp: luồng 2FA tự commit từng bước (đếm lần sai, đốt mã).
 */
@SpringBootTest(properties = {
        // 32 byte 0x01..0x20 — khoá CHỈ dùng trong test.
        "app.security.mfa.encryption-key=AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=",
        "app.security.mfa.recovery-pepper=it-recovery-pepper",
        "app.security.admin-mfa.enforced=true",
        "app.auth.rate-limit.login-max-per-window=10000",
        "app.auth.rate-limit.login-ip-max-per-window=10000",
        "app.auth.rate-limit.refresh-max-per-window=10000",
        "app.auth.rate-limit.mfa-failure-max-per-window=10000",
        "app.auth.rate-limit.mfa-email-send-max-per-window=10000"
})
@AutoConfigureMockMvc
@DisplayName("2FA bắt buộc cho ADMIN — Integration")
class AdminMfaFlowIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String PASSWORD = "MatKhauAdmin123!";
    private static final Pattern SUBJECT_CODE = Pattern.compile("^(\\d{6}) ");
    private static final Pattern REFRESH_COOKIE = Pattern.compile("refresh_token=([^;]+)");

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;

    @MockBean private TransactionalMail mail;

    @BeforeEach
    void mailOn() {
        reset(mail);
        when(mail.isEnabled()).thenReturn(true);
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private User newUser(User.Role role) {
        return userRepository.save(User.builder()
                .email("mfa-it-" + UUID.randomUUID() + "@test.local")
                .passwordHash(passwordEncoder.encode(PASSWORD))
                .displayName("IT " + role)
                .role(role)
                .locale(User.Locale.vi)
                .build());
    }

    private ResultActions postJson(String path, Map<String, ?> body) throws Exception {
        return mockMvc.perform(post(path).contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)));
    }

    private JsonNode json(MvcResult r) throws Exception {
        return objectMapper.readTree(r.getResponse().getContentAsString());
    }

    private String login(User u) throws Exception {
        MvcResult r = postJson("/api/auth/login", Map.of("email", u.getEmail(), "password", PASSWORD))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mfaRequired").value(true))
                .andExpect(jsonPath("$.accessToken").doesNotExist())
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andExpect(jsonPath("$.role").doesNotExist())
                .andExpect(header().doesNotExist("Set-Cookie"))
                .andReturn();
        return json(r).get("mfaToken").asText();
    }

    private String lastEmailCode(String to) {
        ArgumentCaptor<String> subject = ArgumentCaptor.forClass(String.class);
        verify(mail, atLeastOnce()).sendRich(eq("admin-mfa-enroll"), eq(to), subject.capture(), anyString(), anyString());
        List<String> all = subject.getAllValues();
        Matcher m = SUBJECT_CODE.matcher(all.get(all.size() - 1));
        assertThat(m.find()).as("tiêu đề thư mang mã 6 số").isTrue();
        return m.group(1);
    }

    private static String totp(String secretB32) {
        return Totp.code(Base32.decode(secretB32), Totp.stepAt(Instant.now()));
    }

    private static String wrong(String code) {
        return "000000".equals(code) ? "111111" : "000000";
    }

    private static String refreshCookie(MvcResult r) {
        for (String h : r.getResponse().getHeaders("Set-Cookie")) {
            Matcher m = REFRESH_COOKIE.matcher(h);
            if (m.find() && !m.group(1).isBlank()) {
                return m.group(1);
            }
        }
        throw new AssertionError("không có cookie refresh_token");
    }

    private record Enrolled(String secretB32, List<String> recoveryCodes, String accessToken, String refreshToken) {}

    /** Đi trọn luồng bật 2FA, trả bí mật + mã khôi phục + phiên. */
    private Enrolled enroll(User admin) throws Exception {
        String mfaToken = login(admin);
        postJson("/api/auth/mfa/email-code", Map.of("mfaToken", mfaToken))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.emailHint").value(MfaService.emailHint(admin.getEmail())));
        String emailCode = lastEmailCode(admin.getEmail());

        MvcResult start = postJson("/api/auth/mfa/enroll/start", Map.of("mfaToken", mfaToken, "emailCode", emailCode))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.otpauthUri").value(org.hamcrest.Matchers.startsWith("otpauth://totp/DeutschFlow:")))
                .andReturn();
        String secret = json(start).get("secretBase32").asText();
        String token2 = json(start).get("mfaToken").asText();

        MvcResult confirm = postJson("/api/auth/mfa/enroll/confirm", Map.of("mfaToken", token2, "code", totp(secret)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recoveryCodes.length()").value(10))
                .andExpect(jsonPath("$.session.accessToken").exists())
                .andExpect(jsonPath("$.session.refreshToken").doesNotExist())
                .andExpect(jsonPath("$.session.role").value("ADMIN"))
                .andReturn();
        List<String> codes = new ArrayList<>();
        json(confirm).get("recoveryCodes").forEach(n -> codes.add(n.asText()));
        return new Enrolled(secret, codes, json(confirm).get("session").get("accessToken").asText(), refreshCookie(confirm));
    }

    // ─── ca ───────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Luồng đầy đủ: đăng ký (mã email → QR → TOTP) → 10 mã → phiên dùng được; dữ liệu lưu đã mã hoá/băm")
    void enrollmentFlow() throws Exception {
        User admin = newUser(User.Role.ADMIN);

        // Trước khi bật: token ADMIN không dấu 2FA bị chặn ở filter.
        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + jwtService.generateAccessToken(admin)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.extensions.code").value("MFA_REQUIRED"));

        String firstToken = login(admin);
        // Mã email sai → 400, chưa có bí mật nào.
        postJson("/api/auth/mfa/email-code", Map.of("mfaToken", firstToken)).andExpect(status().isAccepted());
        String emailCode = lastEmailCode(admin.getEmail());
        postJson("/api/auth/mfa/enroll/start", Map.of("mfaToken", firstToken, "emailCode", wrong(emailCode)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.extensions.code").value("MFA_CODE_INVALID"));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM user_mfa WHERE user_id = ?", Integer.class, admin.getId()))
                .isZero();
        // Bảng mã email chỉ giữ hash.
        assertThat(jdbc.queryForList("SELECT code_hash FROM mfa_email_codes WHERE user_id = ?", String.class, admin.getId()))
                .allSatisfy(h -> assertThat(h).hasSize(64).isNotEqualTo(emailCode));

        Enrolled e = enroll(admin);

        Map<String, Object> row = jdbc.queryForMap("SELECT secret_enc, enabled_at FROM user_mfa WHERE user_id = ?", admin.getId());
        assertThat((String) row.get("secret_enc")).startsWith("v1:k1:").doesNotContain(e.secretB32());
        assertThat(row.get("enabled_at")).isNotNull();
        List<String> hashes = jdbc.queryForList(
                "SELECT code_hash FROM user_mfa_recovery_codes WHERE user_id = ? AND used_at IS NULL", String.class, admin.getId());
        assertThat(hashes).hasSize(10).noneMatch(h -> e.recoveryCodes().stream().anyMatch(h::contains));
        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM refresh_tokens WHERE user_id = ? AND NOT revoked AND mfa_verified_at IS NOT NULL",
                Integer.class, admin.getId())).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE event_name = 'user.mfa.enabled' AND target_id = ?",
                Integer.class, String.valueOf(admin.getId()))).isEqualTo(1);

        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + e.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ADMIN"));
        mockMvc.perform(get("/api/profile/me/mfa").header("Authorization", "Bearer " + e.accessToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.recoveryCodesRemaining").value(10));

        // Đã bật thì không bắt đầu lại được.
        String again = login(admin);
        postJson("/api/auth/mfa/email-code", Map.of("mfaToken", again))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.extensions.code").value("MFA_ALREADY_ENABLED"));
    }

    @Test
    @DisplayName("Token thử thách đã đổi ra token mới (enroll/start) thì không dùng lại được")
    void challengeTokenBurnedAfterStart() throws Exception {
        User admin = newUser(User.Role.ADMIN);
        String token = login(admin);
        postJson("/api/auth/mfa/email-code", Map.of("mfaToken", token)).andExpect(status().isAccepted());
        MvcResult start = postJson("/api/auth/mfa/enroll/start",
                Map.of("mfaToken", token, "emailCode", lastEmailCode(admin.getEmail())))
                .andExpect(status().isOk()).andReturn();
        String secret = json(start).get("secretBase32").asText();

        postJson("/api/auth/mfa/enroll/confirm", Map.of("mfaToken", token, "code", totp(secret)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.extensions.code").value("MFA_TOKEN_INVALID"));
    }

    @Test
    @DisplayName("Đăng nhập lại: TOTP đã dùng bị từ chối (phát lại); mã khôi phục dùng được ĐÚNG một lần")
    void verifyTotpReplayAndRecoverySingleUse() throws Exception {
        User admin = newUser(User.Role.ADMIN);
        Enrolled e = enroll(admin);

        // Cùng bước thời gian với lần xác nhận → mã đã dùng → từ chối.
        String token = login(admin);
        MvcResult loginBody = postJson("/api/auth/login", Map.of("email", admin.getEmail(), "password", PASSWORD))
                .andExpect(jsonPath("$.enrolled").value(true)).andReturn();
        assertThat(json(loginBody).get("mfaToken").asText()).isNotBlank();
        long lastStep = jdbc.queryForObject("SELECT last_used_step FROM user_mfa WHERE user_id = ?", Long.class, admin.getId());
        String usedCode = Totp.code(Base32.decode(e.secretB32()), lastStep);
        postJson("/api/auth/mfa/verify", Map.of("mfaToken", token, "code", usedCode))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.extensions.code").value("MFA_CODE_INVALID"));

        // Mã khôi phục lần một → phiên + cookie.
        String recovery = e.recoveryCodes().get(0);
        postJson("/api/auth/mfa/verify", Map.of("mfaToken", token, "recoveryCode", recovery.toLowerCase()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").exists())
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.containsString("refresh_token=")));
        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM user_mfa_recovery_codes WHERE user_id = ? AND used_at IS NULL", Integer.class, admin.getId()))
                .isEqualTo(9);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs WHERE event_name = 'user.mfa.recovery_used' AND target_id = ?",
                Integer.class, String.valueOf(admin.getId()))).isEqualTo(1);

        // Token thử thách đã đổi ra phiên → đốt.
        postJson("/api/auth/mfa/verify", Map.of("mfaToken", token, "recoveryCode", e.recoveryCodes().get(1)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.extensions.code").value("MFA_TOKEN_INVALID"));

        // Mã khôi phục lần hai (token mới) → từ chối.
        String token2 = login(admin);
        postJson("/api/auth/mfa/verify", Map.of("mfaToken", token2, "recoveryCode", recovery))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.extensions.code").value("MFA_CODE_INVALID"));
    }

    @Test
    @DisplayName("Refresh ADMIN chép mfa_verified_at; quá 12 giờ hoặc thiếu thì 401 MFA_REQUIRED")
    void refreshCarriesAndEnforcesMfaAge() throws Exception {
        User admin = newUser(User.Role.ADMIN);
        Enrolled e = enroll(admin);

        MvcResult refreshed = mockMvc.perform(post("/api/auth/refresh").cookie(new Cookie("refresh_token", e.refreshToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").exists())
                .andReturn();
        String newRefresh = refreshCookie(refreshed);
        Instant original = jdbc.queryForObject("SELECT mfa_verified_at FROM refresh_tokens WHERE token = ?",
                java.sql.Timestamp.class, e.refreshToken()).toInstant();
        Instant copied = jdbc.queryForObject("SELECT mfa_verified_at FROM refresh_tokens WHERE token = ?",
                java.sql.Timestamp.class, newRefresh).toInstant();
        assertThat(copied).isEqualTo(original);
        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + json(refreshed).get("accessToken").asText()))
                .andExpect(status().isOk());

        jdbc.update("UPDATE refresh_tokens SET mfa_verified_at = now() - interval '13 hours' WHERE token = ?", newRefresh);
        mockMvc.perform(post("/api/auth/refresh").cookie(new Cookie("refresh_token", newRefresh)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.extensions.code").value("MFA_REQUIRED"));

        jdbc.update("UPDATE refresh_tokens SET mfa_verified_at = NULL WHERE token = ?", newRefresh);
        mockMvc.perform(post("/api/auth/refresh").cookie(new Cookie("refresh_token", newRefresh)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.extensions.code").value("MFA_REQUIRED"));
    }

    @Test
    @DisplayName("Admin khác đặt lại 2FA (bắt buộc lý do) → xoá 2FA, cắt phiên, vết; tự đặt lại → 403")
    void adminResetByAnotherAdmin() throws Exception {
        User target = newUser(User.Role.ADMIN);
        enroll(target);
        User other = newUser(User.Role.ADMIN);
        String otherToken = jwtService.generateAccessToken(other, null, null, Instant.now());

        mockMvc.perform(post("/api/admin/users/" + target.getId() + "/mfa/reset")
                        .header("Authorization", "Bearer " + otherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"ngắn\"}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/admin/users/" + target.getId() + "/mfa/reset")
                        .header("Authorization", "Bearer " + otherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", "Mất điện thoại, đã xác minh qua gọi video"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hadMfa").value(true));

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM user_mfa WHERE user_id = ?", Integer.class, target.getId())).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM user_mfa_recovery_codes WHERE user_id = ?", Integer.class, target.getId())).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM refresh_tokens WHERE user_id = ? AND NOT revoked", Integer.class, target.getId())).isZero();
        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM audit_logs WHERE event_name = 'admin.user.mfa.reset' AND target_id = ? AND actor_user_id = ?",
                Integer.class, String.valueOf(target.getId()), other.getId())).isEqualTo(1);

        // Đăng nhập lại: thử thách đăng ký từ đầu.
        postJson("/api/auth/login", Map.of("email", target.getEmail(), "password", PASSWORD))
                .andExpect(jsonPath("$.enrolled").value(false));

        // Tự đặt lại → 403, kể cả có lý do.
        mockMvc.perform(post("/api/admin/users/" + other.getId() + "/mfa/reset")
                        .header("Authorization", "Bearer " + otherToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("reason", "Tự đặt lại cho chính mình xem sao"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.extensions.code").value("MFA_RESET_SELF_FORBIDDEN"));
    }

    @Test
    @DisplayName("Người dùng thường: đăng nhập trả token như cũ, không bước 2FA")
    void studentLoginUnchanged() throws Exception {
        User student = newUser(User.Role.STUDENT);
        postJson("/api/auth/login", Map.of("email", student.getEmail(), "password", PASSWORD))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").exists())
                .andExpect(jsonPath("$.role").value("STUDENT"))
                .andExpect(jsonPath("$.mfaRequired").doesNotExist());
    }
}
