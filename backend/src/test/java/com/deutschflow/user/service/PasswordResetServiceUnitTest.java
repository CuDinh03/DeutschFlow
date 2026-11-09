package com.deutschflow.user.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.mail.TransactionalMail;
import com.deutschflow.user.registration.RegistrationCodes;
import com.deutschflow.user.registration.RegistrationVerificationConfig;
import com.deutschflow.user.repository.RefreshTokenRepository;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import com.deutschflow.testsupport.SentMails;
import jakarta.mail.internet.MimeMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mockingDetails;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
// Lenient: JdbcTemplate#update is varargs, so the unstubbed "mark token used" update call partially
// overlaps the stubbed "update users" call under strict stubbing. Behaviour is asserted via verify().
@MockitoSettings(strictness = Strictness.LENIENT)
class PasswordResetServiceUnitTest {

    private static final String PEPPER = "unit-test-pepper-0123456789abcdefghij";
    private static final byte[] PEPPER_BYTES = PEPPER.getBytes(StandardCharsets.UTF_8);
    private static final int MAX_ATTEMPTS = 5;

    @Mock JdbcTemplate jdbc;
    @Mock JavaMailSender mailSender;
    @Mock PasswordEncoder passwordEncoder;
    @Mock RefreshTokenRepository refreshTokenRepository;
    @Mock com.deutschflow.common.audit.AuditLogService auditLogService;

    PasswordResetService service;

    @BeforeEach
    void setUp() {
        var mail = new TransactionalMail(mailSender, "smtp.example.com",
                "support@mydeutschflow.com", "support@mydeutschflow.com", new SimpleMeterRegistry());
        SentMails.stub(mailSender);
        // Executor chạy ngay trên luồng test: không có transaction nên afterCommit cũng chạy ngay.
        service = new PasswordResetService(jdbc, mail, passwordEncoder, refreshTokenRepository, Runnable::run,
                config(PEPPER), auditLogService);
        // INSERT ... RETURNING id của requestReset.
        when(jdbc.queryForObject(contains("INSERT INTO password_reset_tokens"), eq(Long.class), any(), any()))
                .thenReturn(42L);
    }

    private static RegistrationVerificationConfig config(String pepper) {
        return new RegistrationVerificationConfig(false, pepper, 60, MAX_ATTEMPTS, 60, true, "");
    }

    /** Dòng mã mới nhất còn mở của user@x.com, hash của {@code code} với id {@code id}. */
    private void openToken(long id, String code, int attempts, long expiresInMillis) {
        Map<String, Object> row = new HashMap<>();
        row.put("id", id);
        row.put("code_hash", code == null ? null : RegistrationCodes.hash(PEPPER_BYTES, id, code));
        row.put("attempts", attempts);
        row.put("expires_at", new Timestamp(System.currentTimeMillis() + expiresInMillis));
        when(jdbc.queryForList(contains("FROM password_reset_tokens"), eq("user@x.com")))
                .thenReturn(List.of(row));
    }

    /**
     * Regression guard for the forgot-password column bug: the UPDATE must target {@code password_hash}.
     * The old SQL said {@code SET password = ?}, but {@code users} has no {@code password} column — so
     * every OTP reset threw a SQL error AFTER the token was marked used. The password never changed yet
     * the user believed it had → login then reported "wrong password".
     */
    @Test
    void resetPassword_updatesPasswordHashColumn() {
        openToken(10L, "123456", 0, 600_000);
        // AUTH-1: the service resolves the user id (needed to revoke that user's sessions) before updating.
        when(jdbc.query(contains("SELECT id FROM users"), any(ResultSetExtractor.class), eq("user@x.com")))
                .thenReturn(20L);
        when(passwordEncoder.encode("newpass12")).thenReturn("HASH");

        service.resetPassword("user@x.com", "123456", "newpass12");

        verify(jdbc).update(contains("SET used = TRUE WHERE id = ?"), eq(10L));
        verify(jdbc).update(contains("password_hash"), eq("HASH"), eq(20L));
        // AUTH-1: a password reset must revoke all of the user's refresh tokens.
        verify(refreshTokenRepository).revokeAllByUserId(20L);
        // Đợt 2 admin: vết "user.password.reset" cho Hoạt động bảo mật, target = chính người đó.
        verify(auditLogService).log(eq("user.password.reset"), any(com.deutschflow.common.audit.AuditActor.class),
                eq("USER"), eq("20"), org.mockito.ArgumentMatchers.<Long>isNull(),
                org.mockito.ArgumentMatchers.<Map<String, Object>>isNull());
    }

    @Test
    void resetPassword_rejectsWhenNoOpenToken() {
        when(jdbc.queryForList(contains("FROM password_reset_tokens"), eq("user@x.com")))
                .thenReturn(List.of());

        assertThrows(BadRequestException.class,
                () -> service.resetPassword("user@x.com", "000000", "newpass12"));

        // No password write may happen when the OTP is invalid.
        verify(jdbc, never()).update(contains("UPDATE users"), any(), any());
        org.mockito.Mockito.verifyNoInteractions(auditLogService);
    }

    @Test
    @DisplayName("mã sai: cộng một lần sai, mã vẫn mở, không đổi mật khẩu, lỗi mang mã RESET_CODE_INVALID")
    void resetPassword_wrongCode_countsAttempt() {
        openToken(10L, "123456", 0, 600_000);

        var ex = assertThrows(BadRequestException.class,
                () -> service.resetPassword("user@x.com", "654321", "newpass12"));

        assertThat(ex.getMessage()).isEqualTo("Mã không đúng hoặc đã hết hạn. Hãy kiểm tra lại mã hoặc gửi mã mới.");
        verify(jdbc).update(contains("SET attempts = ?, used = ?"), eq(1), eq(false), eq(10L));
        verify(jdbc, never()).update(contains("UPDATE users"), any(), any());
        verify(refreshTokenRepository, never()).revokeAllByUserId(any());
    }

    @Test
    @DisplayName("sai tới lần thứ N: mã bị huỷ (used = TRUE), câu lỗi giữ nguyên như mọi lần sai")
    void resetPassword_wrongCodeAtLimit_locksCode() {
        openToken(10L, "123456", MAX_ATTEMPTS - 1, 600_000);

        var ex = assertThrows(BadRequestException.class,
                () -> service.resetPassword("user@x.com", "654321", "newpass12"));

        assertThat(ex.getMessage()).isEqualTo("Mã không đúng hoặc đã hết hạn. Hãy kiểm tra lại mã hoặc gửi mã mới.");
        verify(jdbc).update(contains("SET attempts = ?, used = ?"), eq(MAX_ATTEMPTS), eq(true), eq(10L));
        verify(jdbc, never()).update(contains("UPDATE users"), any(), any());
    }

    @Test
    @DisplayName("mã đúng nhưng hết hạn: từ chối, không đổi mật khẩu")
    void resetPassword_expiredCode_rejected() {
        openToken(10L, "123456", 0, -1_000);

        assertThrows(BadRequestException.class,
                () -> service.resetPassword("user@x.com", "123456", "newpass12"));

        verify(jdbc, never()).update(contains("UPDATE users"), any(), any());
    }

    @Test
    @DisplayName("dòng do bản cũ phát (chỉ có mã thô, không có hash) không dùng được")
    void resetPassword_legacyRowWithoutHash_rejected() {
        openToken(10L, null, 0, 600_000);

        assertThrows(BadRequestException.class,
                () -> service.resetPassword("user@x.com", "123456", "newpass12"));

        verify(jdbc, never()).update(contains("UPDATE users"), any(), any());
    }

    @Test
    @DisplayName("hash gắn với id dòng: mã đúng của dòng khác không qua được")
    void resetPassword_hashBoundToTokenId() {
        Map<String, Object> row = new HashMap<>();
        row.put("id", 11L);
        row.put("code_hash", RegistrationCodes.hash(PEPPER_BYTES, 10L, "123456"));
        row.put("attempts", 0);
        row.put("expires_at", new Timestamp(System.currentTimeMillis() + 600_000));
        when(jdbc.queryForList(contains("FROM password_reset_tokens"), eq("user@x.com"))).thenReturn(List.of(row));

        assertThrows(BadRequestException.class,
                () -> service.resetPassword("user@x.com", "123456", "newpass12"));
    }

    @Test
    @DisplayName("phát mã: DB chỉ nhận hash của mã trong thư, mã thô không đi vào câu SQL nào")
    void requestReset_storesHashNotPlainCode() {
        when(jdbc.queryForList(contains("SELECT locale FROM users"), eq(String.class), eq("user@x.com")))
                .thenReturn(List.of("en"));

        service.requestReset("user@x.com");

        var captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(captor.capture());
        Matcher m = Pattern.compile("^(\\d{6}) ").matcher(SentMails.read(captor.getValue()).subject());
        assertThat(m.find()).isTrue();
        String code = m.group(1);

        verify(jdbc).update(contains("SET code_hash = ?"),
                eq(RegistrationCodes.hash(PEPPER_BYTES, 42L, code)), eq(42L));

        // Duyệt MỌI lời gọi tới JdbcTemplate (update, queryForObject...), trải cả mảng varargs: mã thô không
        // được là một tham số, cũng không được nối vào chuỗi SQL. Bỏ qua chính giá trị hash (hex có thể
        // tình cờ chứa 6 chữ số liền nhau).
        String expectedHash = RegistrationCodes.hash(PEPPER_BYTES, 42L, code);
        for (var inv : mockingDetails(jdbc).getInvocations()) {
            for (Object a : inv.getRawArguments()) {
                List<Object> flat = a instanceof Object[] arr ? Arrays.asList(arr) : java.util.Collections.singletonList(a);
                assertThat(flat).as("mã thô không được ghi vào DB: " + inv).doesNotContain(code);
                for (Object v : flat) {
                    if (v instanceof String s && !s.equals(expectedHash)) {
                        assertThat(s).as("mã thô nằm trong chuỗi gửi DB: " + inv).doesNotContain(code);
                    }
                }
            }
        }
    }

    @Test
    @DisplayName("máy không đặt pepper (dev/test): vẫn phát và kiểm mã được bằng pepper dự phòng")
    void emptyPepper_fallsBackAndStillWorks() {
        var mail = new TransactionalMail(mailSender, "smtp.example.com",
                "support@mydeutschflow.com", "support@mydeutschflow.com", new SimpleMeterRegistry());
        var noPepper = new PasswordResetService(jdbc, mail, passwordEncoder, refreshTokenRepository, Runnable::run,
                config(""), auditLogService);
        when(jdbc.queryForList(contains("SELECT locale FROM users"), eq(String.class), eq("user@x.com")))
                .thenReturn(List.of("vi"));

        assertThatCode(() -> noPepper.requestReset("user@x.com")).doesNotThrowAnyException();

        // Lấy mã trong thư và hash vừa ghi, đưa hash đó lại làm dòng mở, rồi đặt lại mật khẩu bằng mã đó.
        var mailCaptor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(mailCaptor.capture());
        String code = SentMails.read(mailCaptor.getValue()).subject().substring(0, 6);
        var hashCaptor = ArgumentCaptor.forClass(Object.class);
        verify(jdbc).update(contains("SET code_hash = ?"), hashCaptor.capture(), eq(42L));
        Map<String, Object> row = new HashMap<>();
        row.put("id", 42L);
        row.put("code_hash", hashCaptor.getValue());
        row.put("attempts", 0);
        row.put("expires_at", new Timestamp(System.currentTimeMillis() + 600_000));
        when(jdbc.queryForList(contains("FROM password_reset_tokens"), eq("user@x.com"))).thenReturn(List.of(row));
        when(jdbc.query(contains("SELECT id FROM users"), any(ResultSetExtractor.class), eq("user@x.com")))
                .thenReturn(20L);
        when(passwordEncoder.encode("newpass12")).thenReturn("HASH");

        noPepper.resetPassword("user@x.com", code, "newpass12");

        verify(jdbc).update(contains("password_hash"), eq("HASH"), eq(20L));
    }

    @Test
    @DisplayName("sai một lần rồi nhập đúng: vẫn đổi được mật khẩu")
    void resetPassword_wrongThenRight_succeeds() {
        openToken(10L, "123456", 1, 600_000);
        when(jdbc.query(contains("SELECT id FROM users"), any(ResultSetExtractor.class), eq("user@x.com")))
                .thenReturn(20L);
        when(passwordEncoder.encode("newpass12")).thenReturn("HASH");

        service.resetPassword("user@x.com", "123456", "newpass12");

        verify(jdbc).update(contains("password_hash"), eq("HASH"), eq(20L));
        verify(jdbc, never()).update(contains("SET attempts = ?, used = ?"), any(), any(), any());
    }

    @Test
    @DisplayName("mã đúng nhưng tài khoản không còn hoạt động: mã bị tiêu, mật khẩu không đổi, câu lỗi chung")
    void resetPassword_inactiveAccount_consumesCodeWithoutPasswordChange() {
        openToken(10L, "123456", 0, 600_000);
        when(jdbc.query(contains("SELECT id FROM users"), any(ResultSetExtractor.class), eq("user@x.com")))
                .thenReturn(null);

        var ex = assertThrows(BadRequestException.class,
                () -> service.resetPassword("user@x.com", "123456", "newpass12"));

        assertThat(ex.getMessage()).isEqualTo("Mã không đúng hoặc đã hết hạn. Hãy kiểm tra lại mã hoặc gửi mã mới.");
        verify(jdbc).update(contains("SET used = TRUE WHERE id = ?"), eq(10L));
        verify(jdbc, never()).update(contains("UPDATE users SET password_hash"), any(), any());
        verify(refreshTokenRepository, never()).revokeAllByUserId(any());
    }

    /**
     * Thư OTP phải mang danh tính người gửi đã cấu hình.
     *
     * <p>Vì sao cần ca riêng: Gmail SMTP TỰ viết lại header {@code From} thành tài khoản vừa xác thực,
     * nên thiếu {@code setFrom()} thư vẫn đi và không ai thấy. SES thì xác thực {@code MAIL_USERNAME} —
     * một chuỗi {@code AKIA…} chứ không phải địa chỉ email — nên nó không có gì để điền vào {@code From};
     * thư không có {@code From} bị từ chối thẳng. Nghĩa là lỗi chỉ nổ SAU khi đổi biến môi trường sang
     * SES, ở production, đúng lúc người dùng bấm "quên mật khẩu". Ca này bắt nó trước thời điểm đó.
     */
    @Test
    @DisplayName("thư OTP mang đúng From + Reply-To đã cấu hình (SES từ chối thư thiếu From)")
    void requestReset_otpMailCarriesConfiguredSenderIdentity() {
        when(jdbc.queryForList(contains("SELECT locale FROM users"), eq(String.class), eq("user@x.com")))
                .thenReturn(List.of("vi"));

        service.requestReset("user@x.com");

        var captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(captor.capture());
        var sent = SentMails.read(captor.getValue());
        assertThat(sent.from())
                .as("thiếu From là SES từ chối thư OTP")
                .isEqualTo("support@mydeutschflow.com");
        assertThat(sent.replyTo()).isEqualTo("support@mydeutschflow.com");
    }

    @Test
    @DisplayName("thư OTP viết theo ngôn ngữ tài khoản, có cả chữ thuần lẫn HTML, mã ở tiêu đề")
    void requestReset_mailFollowsAccountLocale_andHasBothParts() {
        when(jdbc.queryForList(contains("SELECT locale FROM users"), eq(String.class), eq("user@x.com")))
                .thenReturn(List.of("en"));

        service.requestReset("user@x.com");

        var captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(captor.capture());
        var sent = SentMails.read(captor.getValue());
        Matcher m = Pattern.compile("^(\\d{6}) is your myDeutschFlow password reset code$").matcher(sent.subject());
        assertThat(m.matches()).as("tiêu đề: " + sent.subject()).isTrue();
        String code = m.group(1);
        assertThat(sent.text()).contains(code).contains("15 minutes");
        assertThat(sent.html()).contains("Your code").contains(">" + code.charAt(0) + "<");
    }

    @Test
    @DisplayName("email lạ: không tạo mã, không gửi thư, không giao việc cho executor (trả lời nhanh như email thật)")
    void requestReset_unknownEmail_sendsNothing() {
        when(jdbc.queryForList(contains("SELECT locale FROM users"), eq(String.class), eq("ghost@x.com")))
                .thenReturn(List.of());

        service.requestReset("ghost@x.com");

        verify(mailSender, never()).send(any(MimeMessage.class));
        verify(jdbc, never()).queryForObject(contains("INSERT INTO password_reset_tokens"), eq(Long.class), any(), any());
    }
}
