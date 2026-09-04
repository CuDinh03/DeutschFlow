package com.deutschflow.user.service;

import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
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
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.any;

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
        doNothing().when(mailSender).send(any(org.springframework.mail.SimpleMailMessage.class));
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
