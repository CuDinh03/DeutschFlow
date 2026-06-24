package com.deutschflow.user.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.user.repository.RefreshTokenRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.sql.Timestamp;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
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

    @InjectMocks PasswordResetService service;

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
}
