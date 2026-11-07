package com.deutschflow.user.registration;

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
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.MailSendException;
import com.deutschflow.testsupport.SentMails;
import jakarta.mail.internet.MimeMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Đăng ký có mã PIN trên PostgreSQL thật — các ca IT 1–9 của thiết kế 05/11 §10 (ca 10 ở
 * {@code RegistrationVerificationSwitchIntegrationTest}, ca 11 ở {@code RegistrationVerificationConfigTest}).
 *
 * <p>Thư bắt qua {@link JavaMailSender} giả; mã đọc từ TIÊU ĐỀ thư (đúng nơi người dùng đọc nó). Mã lưu HMAC
 * có pepper nên không đọc được từ DB — đó chính là điều thiết kế muốn.
 *
 * <p>🪤 Không {@code @Transactional} trên lớp: {@code verify} phải COMMIT lần nhập sai rồi mới ném lỗi.
 */
@SpringBootTest(properties = {
        "app.auth.registration-verification.enabled=true",
        "app.auth.registration-verification.code-pepper=it-pepper-0123456789abcdef0123456789abcdef",
        "spring.mail.host=smtp.it.invalid",
        // Mọi request MockMvc cùng một IP: nới trần IP để các ca không chặn lẫn nhau.
        "app.auth.rate-limit.register-max-per-window=10000",
        "app.auth.rate-limit.registration-send-max-per-window=10000",
        "app.auth.rate-limit.registration-verify-ip-max-per-window=10000"
})
@AutoConfigureMockMvc
@DisplayName("Đăng ký có mã PIN — Integration")
class RegistrationVerificationIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final Pattern SUBJECT_CODE = Pattern.compile("^(\\d{6}) ");

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private UserRepository userRepository;
    @Autowired private RegistrationVerificationService service;

    @MockBean private JavaMailSender mailSender;

    @BeforeEach
    void resetMail() {
        reset(mailSender);
        SentMails.stub(mailSender);
        doNothing().when(mailSender).send(any(MimeMessage.class));
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static String newEmail() {
        return "pin-it-" + UUID.randomUUID() + "@test.local";
    }

    private ResultActions start(String email) throws Exception {
        return mockMvc.perform(post("/api/auth/register/start")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "email", email, "password", "MatKhau123!", "displayName", "Học viên PIN",
                        "phoneNumber", "", "locale", "vi"))));
    }

    private ResultActions verifyCode(String email, String code) throws Exception {
        return mockMvc.perform(post("/api/auth/register/verify")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("email", email, "code", code))));
    }

    private ResultActions resend(String email) throws Exception {
        return mockMvc.perform(post("/api/auth/register/resend")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("email", email))));
    }

    /** Thư gần nhất gửi tới {@code email}. */
    private SentMails.Sent lastMailTo(String email) {
        List<SentMails.Sent> mine = new ArrayList<>();
        for (SentMails.Sent m : SentMails.all(mailSender)) {
            if (m.to().contains(email)) mine.add(m);
        }
        assertThat(mine).as("có thư gửi tới " + email).isNotEmpty();
        return mine.get(mine.size() - 1);
    }

    private String lastCodeTo(String email) {
        Matcher m = SUBJECT_CODE.matcher(lastMailTo(email).getSubject());
        assertThat(m.find()).as("tiêu đề thư mang mã 6 số").isTrue();
        return m.group(1);
    }

    private static String wrong(String code) {
        return code.equals("000000") ? "111111" : "000000";
    }

    private int openPending(String email) {
        return jdbc.queryForObject(
                "SELECT COUNT(*) FROM pending_registrations WHERE email = ? AND closed_at IS NULL",
                Integer.class, email);
    }

    private String lastClosedReason(String email) {
        return jdbc.queryForObject("""
                SELECT closed_reason FROM pending_registrations WHERE email = ?
                ORDER BY id DESC LIMIT 1""", String.class, email);
    }

    // ── 1 ────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("1. start ⇒ 202, có hồ sơ mở, CHƯA có users, thư mang mã 6 số và đúng From")
    void start_createsPendingButNoUser() throws Exception {
        String email = newEmail();
        start(email.toUpperCase())
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("CODE_SENT"))
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.codeLength").value(6))
                .andExpect(jsonPath("$.expiresInSeconds").value(3600))
                .andExpect(jsonPath("$.resendAfterSeconds").value(60));

        assertThat(openPending(email)).isEqualTo(1);
        assertThat(userRepository.existsByEmailIgnoreCase(email)).isFalse();
        assertThat(lastCodeTo(email)).matches("\\d{6}");
        assertThat(lastMailTo(email).getFrom()).isNotBlank();
        String hash = jdbc.queryForObject(
                "SELECT code_hash FROM pending_registrations WHERE email = ?", String.class, email);
        assertThat(hash).hasSize(64).doesNotContain(lastCodeTo(email));
    }

    // ── 2 + AC-08 ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("2. verify đúng ⇒ 201 AuthResponse + cookie refresh; có users + trial tính từ lúc xác minh; hồ sơ VERIFIED")
    void verify_correctCode_createsAccountAndSession() throws Exception {
        String email = newEmail();
        start(email).andExpect(status().isAccepted());
        String code = lastCodeTo(email);
        // Đẩy lúc tạo hồ sơ lùi 30 phút: trial phải tính từ LÚC XÁC MINH, không phải lúc bấm đăng ký.
        jdbc.update("UPDATE pending_registrations SET created_at = NOW() - INTERVAL '30 minutes' WHERE email = ?", email);

        verifyCode(email, code)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.role").value("STUDENT"))
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andExpect(header().string("Set-Cookie", containsString("refresh_token=")));

        User user = userRepository.findByEmailIgnoreCase(email).orElseThrow();
        assertThat(user.getCreatedVia()).isEqualTo(User.CreatedVia.SELF);
        assertThat(user.getPasswordHash()).startsWith("$2");
        Integer trials = jdbc.queryForObject("""
                SELECT COUNT(*) FROM user_subscriptions
                WHERE user_id = ? AND starts_at > NOW() - INTERVAL '5 minutes'""", Integer.class, user.getId());
        assertThat(trials).as("trial tính từ lúc xác minh").isEqualTo(1);
        assertThat(lastClosedReason(email)).isEqualTo("VERIFIED");
        assertThat(openPending(email)).isZero();
    }

    // ── 3 ────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("3. sai 4 lần ⇒ remainingAttempts giảm dần; lần 5 ⇒ LOCKED; mã đúng sau đó cũng không vào")
    void wrongCode_fiveTimes_locks() throws Exception {
        String email = newEmail();
        start(email).andExpect(status().isAccepted());
        String code = lastCodeTo(email);

        for (int i = 1; i <= 4; i++) {
            verifyCode(email, wrong(code))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.extensions.reason").value("INVALID_CODE"))
                    .andExpect(jsonPath("$.extensions.remainingAttempts").value(5 - i));
        }
        verifyCode(email, wrong(code))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.extensions.reason").value("LOCKED"));
        verifyCode(email, code)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.extensions.reason").value("INVALID_CODE"));

        assertThat(lastClosedReason(email)).isEqualTo("LOCKED");
        assertThat(userRepository.existsByEmailIgnoreCase(email)).isFalse();
    }

    @Test
    @DisplayName("3b. sau LOCKED, 'gửi lại' mở hồ sơ mới từ dữ liệu form ⇒ mã mới vào được, không gõ lại mật khẩu")
    void afterLock_resendOpensFreshPending() throws Exception {
        String email = newEmail();
        start(email).andExpect(status().isAccepted());
        String code = lastCodeTo(email);
        for (int i = 0; i < 5; i++) verifyCode(email, wrong(code));
        assertThat(lastClosedReason(email)).isEqualTo("LOCKED");

        resend(email).andExpect(status().isNoContent());
        String fresh = lastCodeTo(email);
        verifyCode(email, fresh).andExpect(status().isCreated());
        Integer locked = jdbc.queryForObject("""
                SELECT COUNT(*) FROM pending_registrations WHERE email = ? AND closed_reason = 'LOCKED'""",
                Integer.class, email);
        assertThat(locked).as("hồ sơ cũ giữ lý do LOCKED cho phễu").isEqualTo(1);
    }

    // ── 4 ────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("4. hết hạn ⇒ EXPIRED và hồ sơ đóng EXPIRED")
    void expired() throws Exception {
        String email = newEmail();
        start(email).andExpect(status().isAccepted());
        String code = lastCodeTo(email);
        jdbc.update("UPDATE pending_registrations SET expires_at = NOW() - INTERVAL '1 minute' WHERE email = ?", email);

        verifyCode(email, code)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.extensions.reason").value("EXPIRED"));
        assertThat(lastClosedReason(email)).isEqualTo("EXPIRED");
    }

    // ── 5 ────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("5. resend trong cooldown không gửi; qua cooldown ⇒ mã cũ chết, mã mới chạy, attempts về 0")
    void resend_cooldownThenFreshCode() throws Exception {
        String email = newEmail();
        start(email).andExpect(status().isAccepted());
        String first = lastCodeTo(email);
        verifyCode(email, wrong(first)).andExpect(status().isBadRequest());

        clearInvocations(mailSender);
        resend(email).andExpect(status().isNoContent());
        verify(mailSender, never()).send(any(MimeMessage.class));

        jdbc.update("UPDATE pending_registrations SET last_sent_at = NOW() - INTERVAL '2 minutes' WHERE email = ?", email);
        resend(email).andExpect(status().isNoContent());
        String second = lastCodeTo(email);
        Integer attempts = jdbc.queryForObject(
                "SELECT attempts FROM pending_registrations WHERE email = ? AND closed_at IS NULL", Integer.class, email);
        assertThat(attempts).isZero();

        if (!second.equals(first)) {
            verifyCode(email, first)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.extensions.reason").value("INVALID_CODE"));
        }
        verifyCode(email, second).andExpect(status().isCreated());
    }

    @Test
    @DisplayName("5b. resend với email lạ vẫn 204 và không gửi gì")
    void resend_unknownEmail_silent() throws Exception {
        clearInvocations(mailSender);
        resend(newEmail()).andExpect(status().isNoContent());
        verify(mailSender, never()).send(any(MimeMessage.class));
    }

    // ── 6 ────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("6. email đã có tài khoản ⇒ 202 y hệt, không hồ sơ, thư 'đã có tài khoản'; verify ⇒ INVALID_CODE")
    void existingAccount_isSilent() throws Exception {
        String email = newEmail();
        userRepository.save(User.builder().email(email).passwordHash("$2a$10$h")
                .displayName("Đã có").role(User.Role.STUDENT).build());

        start(email)
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("CODE_SENT"))
                .andExpect(jsonPath("$.codeLength").value(6));

        Integer rows = jdbc.queryForObject(
                "SELECT COUNT(*) FROM pending_registrations WHERE email = ?", Integer.class, email);
        assertThat(rows).isZero();
        SentMails.Sent mail = lastMailTo(email);
        assertThat(mail.getSubject()).doesNotContainPattern("\\d{6}");
        assertThat(mail.getText()).contains("/v2/login").contains("/v2/forgot-password");

        verifyCode(email, "123456")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.extensions.reason").value("INVALID_CODE"));
    }

    // ── 7 ────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("7. hai verify đúng chạy song song ⇒ đúng MỘT tài khoản")
    void concurrentVerify_createsExactlyOneUser() throws Exception {
        String email = newEmail();
        start(email).andExpect(status().isAccepted());
        String code = lastCodeTo(email);

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch go = new CountDownLatch(1);
        try {
            List<Future<Boolean>> results = new ArrayList<>();
            for (int i = 0; i < 2; i++) {
                results.add(pool.submit(() -> {
                    go.await();
                    try {
                        service.verify(email, code);
                        return true;
                    } catch (RegistrationVerificationException e) {
                        return false;
                    }
                }));
            }
            go.countDown();
            int ok = 0;
            for (Future<Boolean> f : results) if (f.get()) ok++;
            assertThat(ok).isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }
        Integer users = jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE email = ?", Integer.class, email);
        assertThat(users).isEqualTo(1);
    }

    // ── 8 ────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("8. /register cũ tạo tài khoản giữa start và verify ⇒ 409")
    void legacyRegisterRace_conflict() throws Exception {
        String email = newEmail();
        start(email).andExpect(status().isAccepted());
        String code = lastCodeTo(email);

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", email, "password", "MatKhau123!", "displayName", "Đường cũ"))))
                .andExpect(status().isCreated());

        verifyCode(email, code)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.extensions.reason").value("ACCOUNT_EXISTS"));
        Integer users = jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE email = ?", Integer.class, email);
        assertThat(users).isEqualTo(1);
    }

    // ── 9 ────────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("9. gửi thư hỏng ⇒ 503 + hồ sơ SEND_FAILED (không báo 'đã gửi' khi chưa gửi)")
    void sendFailure_503() throws Exception {
        String email = newEmail();
        doThrow(new MailSendException("smtp down")).when(mailSender).send(any(MimeMessage.class));

        start(email)
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.extensions.reason").value("SEND_FAILED"));
        assertThat(lastClosedReason(email)).isEqualTo("SEND_FAILED");
        assertThat(openPending(email)).isZero();
    }

    @Test
    @DisplayName("chống bot: email hộp thư tạm ⇒ 400 DISPOSABLE_EMAIL, không hồ sơ, không thư (cả /register cũ)")
    void disposableEmail_rejected() throws Exception {
        String email = "pin-it-" + UUID.randomUUID() + "@mailinator.com";
        start(email)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.extensions.reason").value("DISPOSABLE_EMAIL"));
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", email, "password", "MatKhau123!", "displayName", "Bot"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.extensions.reason").value("DISPOSABLE_EMAIL"));
        Integer rows = jdbc.queryForObject(
                "SELECT COUNT(*) FROM pending_registrations WHERE email = ?", Integer.class, email);
        assertThat(rows).isZero();
        verify(mailSender, never()).send(any(MimeMessage.class));
    }

    @Test
    @DisplayName("chống bot: ô honeypot `website` có giá trị ⇒ 400 HUMAN_CHECK_FAILED, không hồ sơ")
    void honeypot_rejected() throws Exception {
        String email = newEmail();
        mockMvc.perform(post("/api/auth/register/start")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", email, "password", "MatKhau123!", "displayName", "Bot",
                                "website", "http://spam.example"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.extensions.reason").value("HUMAN_CHECK_FAILED"));
        assertThat(openPending(email)).isZero();
    }

    @Test
    @DisplayName("start lần hai cho cùng email ⇒ hồ sơ cũ SUPERSEDED, chỉ một hồ sơ mở")
    void secondStart_supersedes() throws Exception {
        String email = newEmail();
        start(email).andExpect(status().isAccepted());
        String first = lastCodeTo(email);
        start(email).andExpect(status().isAccepted());

        assertThat(openPending(email)).isEqualTo(1);
        Integer superseded = jdbc.queryForObject("""
                SELECT COUNT(*) FROM pending_registrations WHERE email = ? AND closed_reason = 'SUPERSEDED'""",
                Integer.class, email);
        assertThat(superseded).isEqualTo(1);
        String second = lastCodeTo(email);
        if (!second.equals(first)) {
            verifyCode(email, first).andExpect(status().isBadRequest());
        }
        verifyCode(email, second).andExpect(status().isCreated());
    }
}
