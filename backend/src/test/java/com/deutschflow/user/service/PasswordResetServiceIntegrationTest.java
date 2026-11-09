package com.deutschflow.user.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.testsupport.SentMails;
import jakarta.mail.internet.MimeMessage;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.jdbc.Sql;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;

/**
 * Guards the forgot-password flow against a class of bug that the mock-only unit test cannot catch:
 * the service builds raw SQL strings, so a wrong column name only fails against a real schema.
 *
 * Regression: {@code requestReset} queried {@code WHERE active = TRUE} but the column is
 * {@code is_active} (User#active maps to {@code is_active}), so EVERY call threw a SQL error → 500
 * for every email, breaking account recovery entirely and defeating the anti-enumeration design.
 */
@SpringBootTest
@Sql(statements = "DELETE FROM password_reset_tokens WHERE email LIKE 'pwd-reset-it-%'")
class PasswordResetServiceIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private PasswordResetService passwordResetService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JdbcTemplate jdbc;

    // Real SMTP is not configured in tests; stub the send so the flow runs end-to-end without it.
    @MockBean
    private JavaMailSender mailSender;

    @Test
    void requestReset_activeAccount_issuesTokenWithoutError() {
        SentMails.stub(mailSender);
        doNothing().when(mailSender).send(any(MimeMessage.class));
        String email = "pwd-reset-it-active@test.com";
        userRepository.save(User.builder()
                .email(email)
                .passwordHash("$2a$10$h")
                .displayName("Reset Active")
                .role(User.Role.STUDENT)
                .build());

        // Before the fix this threw a DataAccessException (bad column) → surfaced as HTTP 500.
        assertThatCode(() -> passwordResetService.requestReset(email))
                .doesNotThrowAnyException();

        Integer tokenCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM password_reset_tokens WHERE email = ? AND NOT used",
                Integer.class, email.toLowerCase());
        assertThat(tokenCount).isEqualTo(1);

        // Thư đi trên taskExecutor SAU khi commit (chống đo thời gian) — vẫn phải tới, mã ở tiêu đề.
        var captor = org.mockito.ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, timeout(5_000)).send(captor.capture());
        String code = SentMails.read(captor.getValue()).subject().substring(0, 6);
        assertThat(code).matches("\\d{6}");

        // V366: DB chỉ giữ hash — cột mã thô để trống, hash là hex 64 ký tự và không chứa mã.
        var row = jdbc.queryForMap(
                "SELECT code, code_hash, attempts FROM password_reset_tokens WHERE email = ? AND NOT used",
                email.toLowerCase());
        assertThat(row.get("code")).isNull();
        assertThat((String) row.get("code_hash")).hasSize(64).doesNotContain(code);
        assertThat(((Number) row.get("attempts")).intValue()).isZero();
    }

    @Test
    void resetPassword_correctCode_changesPasswordAndConsumesCode() {
        String email = "pwd-reset-it-ok@test.com";
        saveUser(email);
        String code = issueCode(email);

        passwordResetService.resetPassword(email, code, "NeuesPasswort2026!");

        String hash = jdbc.queryForObject("SELECT password_hash FROM users WHERE email = ?", String.class, email);
        assertThat(hash).isNotEqualTo("$2a$10$h");
        Integer open = jdbc.queryForObject(
                "SELECT COUNT(*) FROM password_reset_tokens WHERE email = ? AND NOT used", Integer.class, email);
        assertThat(open).isZero();
    }

    /**
     * Lần sai phải được COMMIT dù service ném lỗi ({@code noRollbackFor}) — ca này đi qua proxy Spring thật
     * nên mới bắt được; unit test với mock không thấy transaction.
     */
    @Test
    void resetPassword_wrongCodeFiveTimes_locksCodeEvenForTheRightCode() {
        String email = "pwd-reset-it-lock@test.com";
        saveUser(email);
        String code = issueCode(email);
        String wrong = String.format("%06d", (Integer.parseInt(code) + 1) % 1_000_000);

        for (int i = 0; i < 5; i++) {
            assertThatThrownBy(() -> passwordResetService.resetPassword(email, wrong, "NeuesPasswort2026!"))
                    .isInstanceOf(BadRequestException.class);
        }

        var row = jdbc.queryForMap(
                "SELECT attempts, used FROM password_reset_tokens WHERE email = ? ORDER BY id DESC LIMIT 1", email);
        assertThat(((Number) row.get("attempts")).intValue()).isEqualTo(5);
        assertThat(row.get("used")).isEqualTo(true);

        assertThatThrownBy(() -> passwordResetService.resetPassword(email, code, "NeuesPasswort2026!"))
                .isInstanceOf(BadRequestException.class);
        String hash = jdbc.queryForObject("SELECT password_hash FROM users WHERE email = ?", String.class, email);
        assertThat(hash).isEqualTo("$2a$10$h");
    }

    /**
     * QUY_TRINH_PHAT_HANH §6.2 trên schema thật: màu cũ (trước V366) vẫn INSERT được dòng kiểu cũ trong lúc
     * đổi màu, và bản mới từ chối dòng đó (không có hash) thay vì chấp nhận mã thô.
     */
    @Test
    void legacyRowFromOldColour_insertsFine_butIsRejected() {
        String email = "pwd-reset-it-legacy@test.com";
        saveUser(email);

        assertThatCode(() -> jdbc.update(
                "INSERT INTO password_reset_tokens (email, code, expires_at) VALUES (?, ?, NOW() + INTERVAL '15 minutes')",
                email, "123456")).doesNotThrowAnyException();

        assertThatThrownBy(() -> passwordResetService.resetPassword(email, "123456", "NeuesPasswort2026!"))
                .isInstanceOf(BadRequestException.class);
        String hash = jdbc.queryForObject("SELECT password_hash FROM users WHERE email = ?", String.class, email);
        assertThat(hash).isEqualTo("$2a$10$h");
    }

    private void saveUser(String email) {
        userRepository.save(User.builder()
                .email(email)
                .passwordHash("$2a$10$h")
                .displayName("Reset IT")
                .role(User.Role.STUDENT)
                .build());
    }

    /** Phát mã và đọc nó từ tiêu đề thư — cách duy nhất, vì DB chỉ còn hash. */
    private String issueCode(String email) {
        SentMails.stub(mailSender);
        passwordResetService.requestReset(email);
        var captor = org.mockito.ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, timeout(5_000)).send(captor.capture());
        return SentMails.read(captor.getValue()).subject().substring(0, 6);
    }

    @Test
    void requestReset_unknownEmail_isSilentNoOp() {
        // Anti-enumeration: unknown email must not throw and must not create a token.
        String email = "pwd-reset-it-unknown@test.com";

        assertThatCode(() -> passwordResetService.requestReset(email))
                .doesNotThrowAnyException();

        Integer tokenCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM password_reset_tokens WHERE email = ?",
                Integer.class, email.toLowerCase());
        assertThat(tokenCount).isZero();
    }
}
