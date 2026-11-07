package com.deutschflow.user.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.mail.TransactionalMail;
import com.deutschflow.user.repository.RefreshTokenRepository;
import com.deutschflow.common.mail.CodeMail;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.concurrent.Executor;

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
public class PasswordResetService {

    private static final int OTP_TTL_MINUTES = 15;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final JdbcTemplate jdbc;
    private final TransactionalMail mail;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenRepository refreshTokenRepository;
    private final Executor mailExecutor;

    /**
     * Chống dò email bằng THỜI GIAN (08/11/2026): trước đây thư OTP gửi đồng bộ ngay trong request, nên
     * email có tài khoản chờ SMTP (~1 giây qua Brevo) còn email lạ trả về tức thì — đo thời gian là biết
     * email nào đã đăng ký, dù mã HTTP lúc nào cũng 204. Giờ thư đi trên {@code taskExecutor} sau khi
     * transaction commit, nên hai nhánh trả lời nhanh như nhau.
     */
    @Autowired
    public PasswordResetService(JdbcTemplate jdbc,
                                TransactionalMail mail,
                                PasswordEncoder passwordEncoder,
                                RefreshTokenRepository refreshTokenRepository,
                                @Qualifier("taskExecutor") Executor mailExecutor) {
        this.jdbc = jdbc;
        this.mail = mail;
        this.passwordEncoder = passwordEncoder;
        this.refreshTokenRepository = refreshTokenRepository;
        this.mailExecutor = mailExecutor;
    }

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
        // Lấy luôn ngôn ngữ của tài khoản để thư OTP viết đúng thứ tiếng người dùng chọn.
        List<String> locales = jdbc.queryForList(
                "SELECT locale FROM users WHERE lower(email) = lower(?) AND is_active = TRUE",
                String.class, email.trim()
        );
        if (locales.isEmpty()) {
            log.debug("[PasswordReset] no active account for email (silently ignored)");
            return;
        }

        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        Instant expiresAt = Instant.now().plus(OTP_TTL_MINUTES, ChronoUnit.MINUTES);

        jdbc.update(
                "INSERT INTO password_reset_tokens (email, code, expires_at) VALUES (lower(?), ?, ?)",
                email.trim(), code, java.sql.Timestamp.from(expiresAt)
        );

        String to = email.trim();
        String locale = locales.get(0);
        afterCommit(() -> mailExecutor.execute(() -> sendOtpEmail(to, code, locale)));
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
            throw invalidCode();
        }

        var row = rows.get(0);
        var expiresAt = ((java.sql.Timestamp) row.get("expires_at")).toInstant();
        if (Instant.now().isAfter(expiresAt)) {
            throw invalidCode();
        }

        long tokenId = ((Number) row.get("id")).longValue();
        jdbc.update("UPDATE password_reset_tokens SET used = TRUE WHERE id = ?", tokenId);

        // Column is password_hash (see User entity / V3) — NOT "password". The old "SET password"
        // referenced a non-existent column, so every OTP reset threw a SQL error AFTER the token was
        // already consumed: the password never changed yet the user believed it had → "wrong password".
        Long userId = jdbc.query(
                "SELECT id FROM users WHERE lower(email) = lower(?) AND is_active = TRUE",
                rs -> rs.next() ? rs.getLong(1) : null, email.trim());
        if (userId == null) {
            throw invalidCode();
        }

        jdbc.update("UPDATE users SET password_hash = ? WHERE id = ?",
                passwordEncoder.encode(newPassword), userId);

        // AUTH-1: revoke every refresh token for this user so a leaked/stolen session cannot survive a
        // password reset (access tokens are stateless 15-min; the refresh token is the long-lived one).
        refreshTokenRepository.revokeAllByUserId(userId);
        // The stolen device also holds this account's push token — null it so class-message previews,
        // grades, etc. stop landing on it. A legitimate device re-registers its token on next login.
        jdbc.update("UPDATE users SET push_token = NULL, push_platform = NULL WHERE id = ?", userId);

        log.info("[PasswordReset] password updated + sessions revoked for email={}***",
                email.substring(0, Math.min(3, email.length())));
    }

    /** Mã máy cho mọi lỗi "mã không dùng được" — web chọn câu theo mã này, không theo {@code detail}. */
    public static final String INVALID_CODE = "RESET_CODE_INVALID";

    /**
     * MỘT câu cho mọi trường hợp mã hỏng (sai, đã dùng, hết hạn, tài khoản không còn): chống dò email
     * (08/11/2026). Trước đây "Không tìm thấy tài khoản." và "đã hết hạn" là hai câu riêng; câu chung
     * không cho người lạ suy ra thêm gì, còn người thật chỉ cần biết "lấy mã mới".
     */
    private static BadRequestException invalidCode() {
        return new BadRequestException("Mã không đúng hoặc đã hết hạn. Hãy kiểm tra lại mã hoặc gửi mã mới.", INVALID_CODE);
    }

    /** Chạy sau khi transaction commit (mã đã nằm trong DB trước khi thư rời máy); không có transaction thì chạy ngay. */
    private static void afterCommit(Runnable task) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    task.run();
                }
            });
        } else {
            task.run();
        }
    }

    private void sendOtpEmail(String to, String code, String locale) {
        try {
            // From + Reply-To gắn sẵn trong TransactionalMail; nội dung/giao diện ở CodeMail (mẫu "Thư B").
            var m = CodeMail.code(CodeMail.Purpose.PASSWORD_RESET, locale, code, OTP_TTL_MINUTES);
            mail.sendRich("password-reset", to, m.subject(), m.text(), m.html());
        } catch (Exception e) {
            // Log but do not expose email errors to the caller (and never log the code).
            log.warn("[PasswordReset] failed to send OTP email to {}***: {}",
                    to.substring(0, Math.min(3, to.length())), e.getMessage());
        }
    }
}
