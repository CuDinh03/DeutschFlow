package com.deutschflow.user.mfa;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Truy cập bảng 2FA (V369) bằng JDBC thuần — các câu "phải ảnh hưởng đúng 1 dòng" (chống phát lại mã TOTP,
 * đốt mã khôi phục) là điều kiện an ninh, viết tường minh dễ soát hơn qua JPA.
 */
@Repository
@RequiredArgsConstructor
public class UserMfaStore {

    private final JdbcTemplate jdbc;

    public record MfaRow(long userId, String secretEnc, Instant enabledAt, Long lastUsedStep) {
        public boolean enabled() {
            return enabledAt != null;
        }
    }

    public record EmailCodeRow(long id, String codeHash, int attempts, Instant expiresAt) {}

    // ─── user_mfa ────────────────────────────────────────────────────────────

    public Optional<MfaRow> find(long userId) {
        List<MfaRow> rows = jdbc.query(
                "SELECT user_id, secret_enc, enabled_at, last_used_step FROM user_mfa WHERE user_id = ?",
                (rs, i) -> new MfaRow(
                        rs.getLong("user_id"),
                        rs.getString("secret_enc"),
                        toInstant(rs.getTimestamp("enabled_at")),
                        (Long) rs.getObject("last_used_step", Long.class)),
                userId);
        return rows.stream().findFirst();
    }

    public boolean isEnabled(long userId) {
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM user_mfa WHERE user_id = ? AND enabled_at IS NOT NULL", Integer.class, userId);
        return n != null && n > 0;
    }

    /**
     * Ghi (hoặc thay) bí mật đang chờ xác nhận. Không bao giờ ghi đè một 2FA đã bật.
     *
     * @return {@code false} khi người dùng đã bật 2FA (không có dòng nào được ghi)
     */
    public boolean upsertPending(long userId, String secretEnc) {
        int n = jdbc.update("""
                INSERT INTO user_mfa (user_id, secret_enc, enabled_at, last_used_step, created_at, updated_at)
                VALUES (?, ?, NULL, NULL, now(), now())
                ON CONFLICT (user_id) DO UPDATE
                   SET secret_enc = EXCLUDED.secret_enc, last_used_step = NULL, updated_at = now()
                 WHERE user_mfa.enabled_at IS NULL
                """, userId, secretEnc);
        return n == 1;
    }

    /** Bật 2FA đang chờ. {@code false} khi không có dòng chờ (đã bật rồi, hoặc chưa bắt đầu). */
    public boolean enable(long userId, Instant at) {
        return jdbc.update(
                "UPDATE user_mfa SET enabled_at = ?, updated_at = now() WHERE user_id = ? AND enabled_at IS NULL",
                Timestamp.from(at), userId) == 1;
    }

    /**
     * Chống phát lại: ghi nhận bước TOTP vừa dùng, CHỈ khi nó mới hơn bước đã dùng trước đó. Hai request
     * cùng mã chạy song song thì đúng một request thắng (UPDATE có điều kiện là nguyên tử).
     *
     * @return {@code true} khi đúng 1 dòng được cập nhật (mã chưa từng dùng)
     */
    public boolean claimStep(long userId, long step) {
        return jdbc.update("""
                UPDATE user_mfa SET last_used_step = ?, updated_at = now()
                 WHERE user_id = ? AND (last_used_step IS NULL OR last_used_step < ?)
                """, step, userId, step) == 1;
    }

    /** Xoá toàn bộ 2FA của một người (đặt lại bởi admin khác / runbook). @return số dòng user_mfa đã xoá */
    public int deleteAll(long userId) {
        jdbc.update("DELETE FROM user_mfa_recovery_codes WHERE user_id = ?", userId);
        jdbc.update("DELETE FROM mfa_email_codes WHERE user_id = ?", userId);
        return jdbc.update("DELETE FROM user_mfa WHERE user_id = ?", userId);
    }

    // ─── user_mfa_recovery_codes ────────────────────────────────────────────

    /** Thay TOÀN BỘ mã khôi phục (mã cũ, kể cả chưa dùng, hết hiệu lực). */
    public void replaceRecoveryCodes(long userId, List<String> hashes) {
        jdbc.update("DELETE FROM user_mfa_recovery_codes WHERE user_id = ?", userId);
        jdbc.batchUpdate("INSERT INTO user_mfa_recovery_codes (user_id, code_hash) VALUES (?, ?)",
                hashes.stream().map(h -> new Object[]{userId, h}).toList());
    }

    /** Đốt một mã khôi phục. {@code true} khi đúng 1 dòng chưa dùng khớp (mã đúng và chưa dùng). */
    public boolean consumeRecoveryCode(long userId, String codeHash) {
        return jdbc.update("""
                UPDATE user_mfa_recovery_codes SET used_at = now()
                 WHERE user_id = ? AND code_hash = ? AND used_at IS NULL
                """, userId, codeHash) == 1;
    }

    public int remainingRecoveryCodes(long userId) {
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM user_mfa_recovery_codes WHERE user_id = ? AND used_at IS NULL",
                Integer.class, userId);
        return n == null ? 0 : n;
    }

    // ─── mfa_email_codes ─────────────────────────────────────────────────────

    /** Huỷ mọi mã email còn mở rồi tạo dòng mới; trả id để băm mã kèm id (như V366). */
    public long createEmailCode(long userId, Instant expiresAt) {
        jdbc.update("UPDATE mfa_email_codes SET consumed_at = now() WHERE user_id = ? AND consumed_at IS NULL", userId);
        Long id = jdbc.queryForObject(
                "INSERT INTO mfa_email_codes (user_id, expires_at) VALUES (?, ?) RETURNING id",
                Long.class, userId, Timestamp.from(expiresAt));
        if (id == null) {
            throw new IllegalStateException("Không tạo được mã email 2FA");
        }
        return id;
    }

    public void setEmailCodeHash(long id, String hash) {
        jdbc.update("UPDATE mfa_email_codes SET code_hash = ? WHERE id = ?", hash, id);
    }

    /** Mã email mới nhất còn mở, KHOÁ dòng (FOR UPDATE) để hai lượt đoán song song không ghi đè bộ đếm. */
    public Optional<EmailCodeRow> latestOpenEmailCodeForUpdate(long userId) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT id, code_hash, attempts, expires_at FROM mfa_email_codes
                 WHERE user_id = ? AND consumed_at IS NULL
                 ORDER BY created_at DESC, id DESC
                 LIMIT 1
                 FOR UPDATE
                """, userId);
        if (rows.isEmpty()) {
            return Optional.empty();
        }
        Map<String, Object> r = rows.get(0);
        return Optional.of(new EmailCodeRow(
                ((Number) r.get("id")).longValue(),
                (String) r.get("code_hash"),
                ((Number) r.get("attempts")).intValue(),
                toInstant((Timestamp) r.get("expires_at"))));
    }

    public void recordEmailCodeFailure(long id, int attempts, boolean lock) {
        if (lock) {
            jdbc.update("UPDATE mfa_email_codes SET attempts = ?, consumed_at = now() WHERE id = ?", attempts, id);
        } else {
            jdbc.update("UPDATE mfa_email_codes SET attempts = ? WHERE id = ?", attempts, id);
        }
    }

    public void consumeEmailCode(long id) {
        jdbc.update("UPDATE mfa_email_codes SET consumed_at = now() WHERE id = ?", id);
    }

    private static Instant toInstant(Timestamp ts) {
        return ts == null ? null : ts.toInstant();
    }
}
