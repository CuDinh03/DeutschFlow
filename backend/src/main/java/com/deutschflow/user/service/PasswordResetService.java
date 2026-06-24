package com.deutschflow.user.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.user.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * Handles the two-step forgot-password flow:
 * 1. POST /api/auth/forgot-password  → generate OTP, send email
 * 2. POST /api/auth/reset-password   → verify OTP, update password
 *
 * The OTP is a 6-digit numeric code with a 15-minute TTL.
 * Configure SMTP via spring.mail.* environment variables.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private static final int OTP_TTL_MINUTES = 15;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final JdbcTemplate jdbc;
    private final JavaMailSender mailSender;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenRepository refreshTokenRepository;

    /**
     * Generates a 6-digit OTP for the given email, persists it with a TTL, and
     * sends it via email. Always returns success to prevent email enumeration.
     */
    @Transactional
    public void requestReset(String email) {
        // Invalidate any prior unused tokens for this email before creating a new one.
        jdbc.update(
                "UPDATE password_reset_tokens SET used = TRUE WHERE email = ? AND NOT used",
                email.toLowerCase().trim()
        );

        // Only create/send if the account exists (silently no-ops for unknown emails).
        int count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM users WHERE lower(email) = lower(?) AND active = TRUE",
                Integer.class, email.trim()
        );
        if (count == 0) {
            log.debug("[PasswordReset] no active account for email (silently ignored)");
            return;
        }

        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        Instant expiresAt = Instant.now().plus(OTP_TTL_MINUTES, ChronoUnit.MINUTES);

        jdbc.update(
                "INSERT INTO password_reset_tokens (email, code, expires_at) VALUES (lower(?), ?, ?)",
                email.trim(), code, java.sql.Timestamp.from(expiresAt)
        );

        sendOtpEmail(email.trim(), code);
        log.info("[PasswordReset] OTP issued for email={}***", email.substring(0, Math.min(3, email.length())));
    }

    /**
     * Verifies the OTP and resets the password if valid.
     *
     * @throws BadRequestException if the code is invalid, expired, or already used
     */
    @Transactional
    public void resetPassword(String email, String code, String newPassword) {
        var rows = jdbc.queryForList(
                """
                SELECT id, expires_at FROM password_reset_tokens
                WHERE lower(email) = lower(?)
                  AND code = ?
                  AND NOT used
                ORDER BY created_at DESC
                LIMIT 1
                """,
                email.trim(), code.trim()
        );

        if (rows.isEmpty()) {
            throw new BadRequestException("Mã OTP không hợp lệ hoặc đã được sử dụng.");
        }

        var row = rows.get(0);
        var expiresAt = ((java.sql.Timestamp) row.get("expires_at")).toInstant();
        if (Instant.now().isAfter(expiresAt)) {
            throw new BadRequestException("Mã OTP đã hết hạn. Vui lòng yêu cầu lại.");
        }

        long tokenId = ((Number) row.get("id")).longValue();
        jdbc.update("UPDATE password_reset_tokens SET used = TRUE WHERE id = ?", tokenId);

        // Column is password_hash (see User entity / V3) — NOT "password". The old "SET password"
        // referenced a non-existent column, so every OTP reset threw a SQL error AFTER the token was
        // already consumed: the password never changed yet the user believed it had → "wrong password".
        Long userId = jdbc.query(
                "SELECT id FROM users WHERE lower(email) = lower(?) AND active = TRUE",
                rs -> rs.next() ? rs.getLong(1) : null, email.trim());
        if (userId == null) {
            throw new BadRequestException("Không tìm thấy tài khoản.");
        }

        jdbc.update("UPDATE users SET password_hash = ? WHERE id = ?",
                passwordEncoder.encode(newPassword), userId);

        // AUTH-1: revoke every refresh token for this user so a leaked/stolen session cannot survive a
        // password reset (access tokens are stateless 15-min; the refresh token is the long-lived one).
        refreshTokenRepository.revokeAllByUserId(userId);

        log.info("[PasswordReset] password updated + sessions revoked for email={}***",
                email.substring(0, Math.min(3, email.length())));
    }

    private void sendOtpEmail(String to, String code) {
        try {
            var msg = new SimpleMailMessage();
            msg.setTo(to);
            msg.setSubject("DeutschFlow — Mã đặt lại mật khẩu");
            msg.setText(
                    "Xin chào,\n\n" +
                    "Mã đặt lại mật khẩu của bạn là:\n\n" +
                    "    " + code + "\n\n" +
                    "Mã có hiệu lực trong " + OTP_TTL_MINUTES + " phút.\n" +
                    "Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.\n\n" +
                    "DeutschFlow Team"
            );
            mailSender.send(msg);
        } catch (Exception e) {
            // Log but do not expose email errors to the caller.
            log.warn("[PasswordReset] failed to send OTP email to {}: {}", to, e.getMessage());
        }
    }
}
