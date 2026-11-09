package com.deutschflow.user.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.mail.TransactionalMail;
import com.deutschflow.user.registration.RegistrationCodes;
import com.deutschflow.user.registration.RegistrationVerificationConfig;
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

import java.nio.charset.StandardCharsets;
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
 *
 * <p><b>Lưu mã (V366, 09/11/2026):</b> bảng chỉ giữ {@code code_hash} = HMAC-SHA256(pepper, id + ":" + mã)
 * qua lõi {@link RegistrationCodes} của luồng đăng ký; mã thô chỉ nằm trong thư. Mỗi mã có
 * {@code attempts}: nhập sai thì cộng một và COMMIT trước khi báo lỗi, đủ ngưỡng thì mã bị huỷ — kẻ dò
 * chỉ có vài lượt cho mỗi mã thay vì cả cửa sổ rate-limit.
 */
@Slf4j
@Service
public class PasswordResetService {

    private static final int OTP_TTL_MINUTES = 15;

    /**
     * Pepper dự phòng khi máy không cấu hình {@code REGISTRATION_CODE_PEPPER} (máy dev, test). Repo public
     * nên dự phòng này KHÔNG bảo vệ gì khi rò DB — chỉ để luồng vẫn chạy (bảo vệ ngang mức trước V366).
     * Prod đang bật luồng mã PIN nên {@link RegistrationVerificationConfig} buộc có pepper; nhưng tắt mã PIN
     * mà XOÁ luôn pepper thì prod sẽ rơi vào đây — log ERROR để thấy. Tắt mã PIN thì giữ nguyên pepper.
     */
    private static final byte[] FALLBACK_PEPPER =
            "deutschflow-password-reset-dev-only-pepper".getBytes(StandardCharsets.UTF_8);

    private final JdbcTemplate jdbc;
    private final TransactionalMail mail;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenRepository refreshTokenRepository;
    private final Executor mailExecutor;
    private final byte[] pepper;
    private final int maxAttemptsPerCode;

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
                                @Qualifier("taskExecutor") Executor mailExecutor,
                                RegistrationVerificationConfig codeConfig) {
        this.jdbc = jdbc;
        this.mail = mail;
        this.passwordEncoder = passwordEncoder;
        this.refreshTokenRepository = refreshTokenRepository;
        this.mailExecutor = mailExecutor;
        byte[] configured = codeConfig.pepper();
        if (configured.length == 0) {
            log.error("[PasswordReset] REGISTRATION_CODE_PEPPER chưa đặt — mã quên mật khẩu băm bằng pepper dự phòng công khai (chỉ chấp nhận ở máy dev/test)");
            this.pepper = FALLBACK_PEPPER.clone();
        } else {
            this.pepper = configured;
        }
        this.maxAttemptsPerCode = codeConfig.maxAttemptsPerCode();
    }

    /**
     * Generates a 6-digit OTP for the given email, persists its hash with a TTL, and
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

        String code = RegistrationCodes.generate();
        Instant expiresAt = Instant.now().plus(OTP_TTL_MINUTES, ChronoUnit.MINUTES);

        // Hash ghép id của chính dòng này (như hồ sơ đăng ký) nên phải có id trước rồi mới ghi hash.
        // Cùng transaction: không ai thấy dòng chưa có hash.
        Long tokenId = jdbc.queryForObject(
                "INSERT INTO password_reset_tokens (email, expires_at) VALUES (lower(?), ?) RETURNING id",
                Long.class, email.trim(), java.sql.Timestamp.from(expiresAt)
        );
        jdbc.update("UPDATE password_reset_tokens SET code_hash = ? WHERE id = ?",
                RegistrationCodes.hash(pepper, tokenId, code), tokenId);

        String to = email.trim();
        String locale = locales.get(0);
        afterCommit(() -> mailExecutor.execute(() -> sendOtpEmail(to, code, locale)));
        log.info("[PasswordReset] OTP issued for email={}***", email.substring(0, Math.min(3, email.length())));
    }

    /**
     * Verifies the OTP and resets the password if valid.
     *
     * <p>{@code noRollbackFor}: lần nhập sai phải được COMMIT ({@code attempts++}, có thể kèm huỷ mã)
     * TRƯỚC khi báo lỗi — rollback thì bộ đếm không bao giờ tăng. 🪤 Đừng gọi hàm này từ bên trong một
     * {@code @Transactional} mặc định khác: lỗi ném ra sẽ đánh dấu transaction ngoài rollback-only và bộ
     * đếm lặng lẽ mất (luồng đăng ký tránh việc này bằng {@code TransactionTemplate}).
     *
     * @throws BadRequestException if the code is invalid, expired, already used, or locked after too many tries
     */
    @Transactional(noRollbackFor = BadRequestException.class)
    public void resetPassword(String email, String code, String newPassword) {
        // Chỉ mã MỚI NHẤT còn mở (requestReset đã huỷ mã cũ). FOR UPDATE: hai lượt đoán song song không
        // cùng đọc một giá trị attempts rồi ghi đè nhau.
        var rows = jdbc.queryForList(
                """
                SELECT id, code_hash, attempts, expires_at FROM password_reset_tokens
                WHERE email = lower(?)
                  AND NOT used
                ORDER BY created_at DESC, id DESC
                LIMIT 1
                FOR UPDATE
                """,
                email.trim()
        );

        if (rows.isEmpty()) {
            throw invalidCode();
        }

        var row = rows.get(0);
        long tokenId = ((Number) row.get("id")).longValue();
        var expiresAt = ((java.sql.Timestamp) row.get("expires_at")).toInstant();
        if (Instant.now().isAfter(expiresAt)) {
            throw invalidCode();
        }

        // Dòng do bản cũ phát (chỉ có mã thô, không có hash) không còn dùng được — người dùng gửi mã mới.
        String codeHash = (String) row.get("code_hash");
        String typed = code == null ? null : code.trim();
        if (codeHash == null || !RegistrationCodes.matches(pepper, tokenId, typed, codeHash)) {
            int attempts = ((Number) row.get("attempts")).intValue() + 1;
            boolean lock = attempts >= maxAttemptsPerCode;
            jdbc.update("UPDATE password_reset_tokens SET attempts = ?, used = ? WHERE id = ?",
                    attempts, lock, tokenId);
            if (lock) {
                log.info("[PasswordReset] code locked after {} wrong attempts for email={}***",
                        attempts, email.substring(0, Math.min(3, email.length())));
            }
            // Cùng một câu cho mọi trường hợp — không cho biết còn bao nhiêu lượt hay mã đã bị huỷ.
            throw invalidCode();
        }

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
     * MỘT câu cho mọi trường hợp mã hỏng (sai, đã dùng, hết hạn, bị huỷ vì sai quá nhiều, tài khoản không
     * còn): chống dò email (08/11/2026). Câu chung không cho người lạ suy ra thêm gì, còn người thật chỉ
     * cần biết "lấy mã mới".
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
