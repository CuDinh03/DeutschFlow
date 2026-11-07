package com.deutschflow.user.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.mail.TransactionalMail;
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

import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
// Lenient: JdbcTemplate#update is varargs, so the unstubbed "mark token used" update call partially
// overlaps the stubbed "update users" call under strict stubbing. Behaviour is asserted via verify().
@MockitoSettings(strictness = Strictness.LENIENT)
class PasswordResetServiceUnitTest {

    @Mock JdbcTemplate jdbc;
    @Mock JavaMailSender mailSender;
    @Mock PasswordEncoder passwordEncoder;
    @Mock RefreshTokenRepository refreshTokenRepository;

    PasswordResetService service;

    @BeforeEach
    void setUp() {
        var mail = new TransactionalMail(mailSender, "smtp.example.com",
                "support@mydeutschflow.com", "support@mydeutschflow.com", new SimpleMeterRegistry());
        SentMails.stub(mailSender);
        // Executor chạy ngay trên luồng test: không có transaction nên afterCommit cũng chạy ngay.
        service = new PasswordResetService(jdbc, mail, passwordEncoder, refreshTokenRepository, Runnable::run);
    }

    /**
     * Regression guard for the forgot-password column bug: the UPDATE must target {@code password_hash}.
     * The old SQL said {@code SET password = ?}, but {@code users} has no {@code password} column — so
     * every OTP reset threw a SQL error AFTER the token was marked used. The password never changed yet
     * the user believed it had → login then reported "wrong password".
     */
    @Test
    void resetPassword_updatesPasswordHashColumn() {
        when(jdbc.queryForList(anyString(), eq("user@x.com"), eq("123456")))
                .thenReturn(List.of(Map.of(
                        "id", 10L,
                        "expires_at", new Timestamp(System.currentTimeMillis() + 600_000))));
        // AUTH-1: the service resolves the user id (needed to revoke that user's sessions) before updating.
        when(jdbc.query(contains("SELECT id FROM users"), any(ResultSetExtractor.class), eq("user@x.com")))
                .thenReturn(20L);
        when(passwordEncoder.encode("newpass12")).thenReturn("HASH");

        service.resetPassword("user@x.com", "123456", "newpass12");

        verify(jdbc).update(contains("password_hash"), eq("HASH"), eq(20L));
        // AUTH-1: a password reset must revoke all of the user's refresh tokens.
        verify(refreshTokenRepository).revokeAllByUserId(20L);
    }

    @Test
    void resetPassword_rejectsInvalidOrUsedOtp() {
        when(jdbc.queryForList(anyString(), eq("user@x.com"), eq("000000")))
                .thenReturn(List.of());

        assertThrows(BadRequestException.class,
                () -> service.resetPassword("user@x.com", "000000", "newpass12"));

        // No password write may happen when the OTP is invalid.
        verify(jdbc, org.mockito.Mockito.never()).update(contains("UPDATE users"), any(), any());
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
        verify(jdbc, never()).update(contains("INSERT INTO password_reset_tokens"), any(), any(), any());
    }
}
