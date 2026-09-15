package com.deutschflow.payment.service;

import com.deutschflow.notification.service.UserNotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Kích hoạt gói subscription sau khi thanh toán thành công.
 * Cập nhật bảng user_subscriptions (vô hiệu hoá gói cũ, tạo gói mới ACTIVE).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SubscriptionActivationService {

    private final JdbcTemplate jdbcTemplate;
    private final UserNotificationService userNotificationService;

    @Transactional
    public void activatePlan(Long userId, String planCode, int durationMonths) {
        Instant now = Instant.now();
        Instant endsAt = now.plus(durationMonths * 30L, ChronoUnit.DAYS);
        // Legacy fixed-duration providers (Stripe one-time, MoMo) leave source null.
        activateWithExplicitEnd(userId, planCode, now, endsAt, null, true);
    }

    /**
     * Activate a plan with an explicit end timestamp. Used by Apple IAP, where the renewal date is
     * dictated by Apple ({@code expiresDate}) rather than a fixed duration. Deactivates any existing
     * ACTIVE subscription (latest-purchase-wins) and inserts a fresh ACTIVE row.
     *
     * @param source       provider that owns this entitlement ("APPLE"); {@code null} for legacy Stripe/MoMo
     * @param notifyAdmins fire the "learner subscribed" admin notification (skip on silent auto-renewals)
     */
    @Transactional
    public void activateWithExplicitEnd(Long userId, String planCode, Instant startsAt, Instant endsAt,
                                        String source, boolean notifyAdmins) {
        lockUser(userId); // serialize concurrent activations for this user (prevents duplicate ACTIVE rows)
        Instant now = Instant.now();

        // 1. Deactivate all current ACTIVE subscriptions for the user
        int updated = jdbcTemplate.update("""
                UPDATE user_subscriptions
                SET status = 'ENDED', updated_at = ?
                WHERE user_id = ? AND status = 'ACTIVE'
                """, Timestamp.from(now), userId);
        log.info("[SUB] Deactivated {} old subscriptions for userId={}", updated, userId);

        // 2. Insert the new ACTIVE subscription
        jdbcTemplate.update("""
                INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, ends_at, source, created_at, updated_at)
                VALUES (?, ?, 'ACTIVE', ?, ?, ?, ?, ?)
                """,
                userId, planCode,
                Timestamp.from(startsAt),
                endsAt != null ? Timestamp.from(endsAt) : null,
                // V288 làm cột source NOT NULL. Đường cũ (Stripe one-time, MoMo) truyền null,
                // và DEFAULT của cột KHÔNG cứu được vì INSERT này nêu tên cột tường minh.
                source == null ? "UNKNOWN" : source,
                Timestamp.from(now), Timestamp.from(now));
        log.info("[SUB] Activated plan={} for userId={} source={} until={}", planCode, userId, source, endsAt);

        // 3. Seed AI token wallet for PRO/ULTRA (idempotent)
        seedWalletIfNeeded(userId, planCode);

        // 4. Notify admins (skipped on silent renewals)
        if (notifyAdmins) {
            userNotificationService.onLearnerSubscribed(userId, planCode);
        }
    }

    /** Một dòng gói cá nhân vừa bị tạm dừng, để caller ghi sổ kiểm toán. */
    public record PausedRow(String source, String planCode, long remainingSeconds) {}

    /** Dòng gói cá nhân vừa được khôi phục sau khi rời trung tâm. */
    public record ResumedRow(String source, String planCode, long remainingSeconds) {}

    /**
     * Cấp gói TRUNG TÂM mà KHÔNG xoá sổ phần thời gian người dùng đã trả (DEC-09, Q1 owner 07/09).
     *
     * <p>Khác {@link #activateWithExplicitEnd} ở đúng một điểm, và đó là lý do phải tách hàm: hàm kia
     * ENDED mọi dòng ACTIVE. Dùng nó cho đường trung tâm nghĩa là một học viên đang trả tiền gói cá
     * nhân mà được thêm vào trung tâm sẽ mất trắng phần đã trả, rời trung tâm cũng không lấy lại được.
     *
     * <p>Ở đây dòng ĐÃ TRẢ TIỀN còn hạn chuyển sang PAUSED kèm {@code paused_at}; dòng nền
     * (DEFAULT/TRIAL/ORG cũ) và dòng đã hết hạn thì ENDED như cũ.
     *
     * @return các dòng vừa bị tạm dừng — rỗng khi người dùng không có gói cá nhân nào đang chạy
     */
    @Transactional
    public List<PausedRow> activateOrg(Long userId, String planCode, Instant startsAt, Instant endsAt) {
        lockUser(userId);
        Instant now = Instant.now();

        // 1. Tạm dừng gói đã trả tiền còn hạn. `RETURNING` để caller ghi sổ được mà không phải đọc lại.
        List<PausedRow> paused = jdbcTemplate.query("""
                UPDATE user_subscriptions
                SET status = 'PAUSED', paused_at = ?, updated_at = ?
                WHERE user_id = ? AND status = 'ACTIVE'
                  AND source NOT IN ('ORG', 'DEFAULT', 'TRIAL')
                  AND ends_at IS NOT NULL AND ends_at > ?
                RETURNING source, plan_code, ends_at
                """,
                (rs, i) -> new PausedRow(
                        rs.getString("source"),
                        rs.getString("plan_code"),
                        Duration.between(now, rs.getTimestamp("ends_at").toInstant()).getSeconds()),
                Timestamp.from(now), Timestamp.from(now), userId, Timestamp.from(now));

        // 2. Phần ACTIVE còn lại sau bước trên đúng bằng tập cần kết thúc: gói nền và gói đã hết hạn.
        int ended = jdbcTemplate.update("""
                UPDATE user_subscriptions
                SET status = 'ENDED', updated_at = ?
                WHERE user_id = ? AND status = 'ACTIVE'
                """, Timestamp.from(now), userId);

        jdbcTemplate.update("""
                INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, ends_at, source, created_at, updated_at)
                VALUES (?, ?, 'ACTIVE', ?, ?, 'ORG', ?, ?)
                """,
                userId, planCode,
                Timestamp.from(startsAt),
                endsAt != null ? Timestamp.from(endsAt) : null,
                Timestamp.from(now), Timestamp.from(now));

        seedWalletIfNeeded(userId, planCode);
        log.info("[SUB][ORG] Cấp plan={} cho userId={} — tạm dừng {} gói cá nhân, kết thúc {} gói nền",
                planCode, userId, paused.size(), ended);
        return paused;
    }

    /**
     * Khôi phục gói cá nhân sau khi quyền lợi trung tâm chấm dứt (rời trung tâm, hoặc giấy phép của
     * trung tâm hết hạn).
     *
     * <p>Chọn dòng PAUSED còn NHIỀU thời hạn nhất và trả lại đúng phần còn lại tính từ bây giờ; các
     * dòng PAUSED khác kết thúc. Người dùng chỉ được một quyền lợi hiệu lực tại một thời điểm — giữ
     * cả hai sẽ đẻ ra hai dòng ACTIVE, đúng thứ {@code lockUser} sinh ra để ngăn.
     *
     * <p>Không còn gì để khôi phục thì im lặng trả rỗng: {@code QuotaService} tự cấp lại gói DEFAULT.
     */
    @Transactional
    public Optional<ResumedRow> resumePausedIfAny(Long userId) {
        lockUser(userId);
        Instant now = Instant.now();

        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT id, source, plan_code, ends_at, paused_at
                FROM user_subscriptions
                WHERE user_id = ? AND status = 'PAUSED'
                  AND ends_at IS NOT NULL AND paused_at IS NOT NULL
                ORDER BY (ends_at - paused_at) DESC, id DESC
                """, userId);
        if (rows.isEmpty()) {
            return Optional.empty();
        }

        Map<String, Object> best = rows.get(0);
        long remaining = remainingSeconds(best);

        // Phần còn lại <= 0 nghĩa là dòng đó vốn đã hết hạn lúc bị dừng (không nên xảy ra, nhưng nếu
        // xảy ra thì khôi phục nó là cấp quyền lợi âm). Kết thúc tất cả và để DEFAULT lo.
        if (remaining <= 0) {
            endAllPaused(userId, now);
            return Optional.empty();
        }

        jdbcTemplate.update("""
                UPDATE user_subscriptions
                SET status = 'ACTIVE', ends_at = ?, paused_at = NULL, updated_at = ?
                WHERE id = ?
                """,
                Timestamp.from(now.plusSeconds(remaining)), Timestamp.from(now), best.get("id"));

        // Mọi dòng PAUSED còn lại: kết thúc, không tích luỹ.
        endAllPaused(userId, now);

        String source = String.valueOf(best.get("source"));
        String planCode = String.valueOf(best.get("plan_code"));
        log.info("[SUB][ORG] Khôi phục gói cá nhân userId={} source={} plan={} còn {}s",
                userId, source, planCode, remaining);
        return Optional.of(new ResumedRow(source, planCode, remaining));
    }

    private void endAllPaused(Long userId, Instant now) {
        jdbcTemplate.update("""
                UPDATE user_subscriptions
                SET status = 'ENDED', paused_at = NULL, updated_at = ?
                WHERE user_id = ? AND status = 'PAUSED'
                """, Timestamp.from(now), userId);
    }

    private static long remainingSeconds(Map<String, Object> row) {
        Instant endsAt = ((Timestamp) row.get("ends_at")).toInstant();
        Instant pausedAt = ((Timestamp) row.get("paused_at")).toInstant();
        return Duration.between(pausedAt, endsAt).getSeconds();
    }

    /**
     * Apple renewal path. Extends the user's existing ACTIVE Apple entitlement <em>forward only</em>:
     * a late or duplicated App Store Server Notification carrying an older {@code expiresDate} must never
     * shorten the entitlement. When the user has no active Apple subscription yet (initial buy / resubscribe),
     * falls back to a full activation.
     */
    @Transactional
    public void extendOrActivateApple(Long userId, String planCode, Instant startsAt, Instant endsAt,
                                      boolean notifyAdmins) {
        lockUser(userId); // serialize the COUNT-then-write critical section against concurrent notifications

        // Đang là thành viên trung tâm ⇒ dòng Apple nằm ở PAUSED. Gia hạn lúc này CHỈ dời `ends_at`
        // về phía trước và GIỮ NGUYÊN trạng thái tạm dừng: người dùng vẫn dùng quyền của trung tâm,
        // còn phần vừa trả thêm được cộng vào thời hạn sẽ khôi phục khi họ rời trung tâm (DEC-09).
        // Thiếu nhánh này thì mọi lần Apple tự gia hạn sẽ chèn một dòng ACTIVE thứ hai chồng lên
        // quyền của trung tâm.
        Integer pausedApple = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM user_subscriptions
                WHERE user_id = ? AND source = 'APPLE' AND status = 'PAUSED'
                """, Integer.class, userId);
        if (pausedApple != null && pausedApple > 0) {
            int moved = jdbcTemplate.update("""
                    UPDATE user_subscriptions
                    SET ends_at = ?, plan_code = ?, updated_at = ?
                    WHERE user_id = ? AND source = 'APPLE' AND status = 'PAUSED'
                      AND (ends_at IS NULL OR ends_at < ?)
                    """,
                    Timestamp.from(endsAt), planCode, Timestamp.from(Instant.now()),
                    userId, Timestamp.from(endsAt));
            log.info("[SUB][APPLE] Gia hạn khi đang tạm dừng userId={} plan={} tới={} (dời {} dòng)",
                    userId, planCode, endsAt, moved);
            return;
        }

        Integer activeApple = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM user_subscriptions
                WHERE user_id = ? AND source = 'APPLE' AND status = 'ACTIVE'
                """, Integer.class, userId);

        if (activeApple != null && activeApple > 0) {
            int extended = jdbcTemplate.update("""
                    UPDATE user_subscriptions
                    SET ends_at = ?, plan_code = ?, status = 'ACTIVE', updated_at = ?
                    WHERE user_id = ? AND source = 'APPLE' AND status = 'ACTIVE'
                      AND (ends_at IS NULL OR ends_at < ?)
                    """,
                    Timestamp.from(endsAt), planCode, Timestamp.from(Instant.now()),
                    userId, Timestamp.from(endsAt));
            if (extended > 0) {
                log.info("[SUB][APPLE] Extended entitlement userId={} plan={} until={}", userId, planCode, endsAt);
            } else {
                log.info("[SUB][APPLE] Skipped stale renewal for userId={} (entitlement already covers {})", userId, endsAt);
            }
        } else if (hasActiveOrgEntitlement(userId)) {
            // Mua lần đầu / mua lại TRONG LÚC đang là thành viên trung tâm. Không được kích hoạt bình
            // thường: `activateWithExplicitEnd` sẽ ENDED quyền của trung tâm. Ghi thẳng dòng Apple ở
            // trạng thái tạm dừng — nó sẽ được khôi phục nguyên vẹn khi học viên rời trung tâm.
            Instant now = Instant.now();
            jdbcTemplate.update("""
                    INSERT INTO user_subscriptions
                        (user_id, plan_code, status, starts_at, ends_at, source, paused_at, created_at, updated_at)
                    VALUES (?, ?, 'PAUSED', ?, ?, 'APPLE', ?, ?, ?)
                    """,
                    userId, planCode, Timestamp.from(startsAt), Timestamp.from(endsAt),
                    Timestamp.from(now), Timestamp.from(now), Timestamp.from(now));
            seedWalletIfNeeded(userId, planCode);
            log.info("[SUB][APPLE] Mua khi đang ở trung tâm — ghi Apple ở trạng thái tạm dừng userId={} plan={} tới={}",
                    userId, planCode, endsAt);
        } else {
            activateWithExplicitEnd(userId, planCode, startsAt, endsAt, "APPLE", notifyAdmins);
        }
    }

    /** Người dùng đang hưởng quyền lợi do trung tâm cấp? Quyết định Apple vào ACTIVE hay PAUSED. */
    private boolean hasActiveOrgEntitlement(Long userId) {
        Integer orgActive = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM user_subscriptions
                WHERE user_id = ? AND source = 'ORG' AND status = 'ACTIVE'
                """, Integer.class, userId);
        return orgActive != null && orgActive > 0;
    }

    /**
     * Ends the user's Apple-originated entitlement (refund / expire / revoke). Leaves web Stripe/MoMo rows untouched.
     *
     * <p>Bao gồm cả dòng đang TẠM DỪNG vì học viên ở trung tâm: hoàn tiền là hoàn tiền, không thể để
     * sót một dòng chờ sẵn rồi khôi phục quyền đã bị thu hồi lúc họ rời trung tâm.
     */
    @Transactional
    public void endAppleSubscription(Long userId) {
        int ended = jdbcTemplate.update("""
                UPDATE user_subscriptions
                SET status = 'ENDED', paused_at = NULL, updated_at = ?
                WHERE user_id = ? AND source = 'APPLE' AND status IN ('ACTIVE', 'PAUSED')
                """, Timestamp.from(Instant.now()), userId);
        log.info("[SUB][APPLE] Ended {} Apple entitlement(s) for userId={}", ended, userId);
    }

    /**
     * Transaction-scoped advisory lock keyed by user id. Serializes concurrent entitlement mutations for the
     * same user (e.g. a client {@code /verify} racing an App Store Server Notification) so the read-then-write
     * paths cannot interleave into duplicate ACTIVE rows. Released automatically at transaction end.
     */
    private void lockUser(long userId) {
        jdbcTemplate.query("SELECT pg_advisory_xact_lock(?)", rs -> null, userId);
    }

    private void seedWalletIfNeeded(Long userId, String planCode) {
        if ("PRO".equalsIgnoreCase(planCode) || "ULTRA".equalsIgnoreCase(planCode)) {
            // Kiểm tra xem đã có wallet chưa
            Integer exists = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM user_ai_token_wallets WHERE user_id = ?",
                    Integer.class, userId);
            if (exists != null && exists == 0) {
                // Lấy daily_token_grant từ plan
                Long grant = jdbcTemplate.queryForObject(
                        "SELECT daily_token_grant FROM subscription_plans WHERE code = ?",
                        Long.class, planCode);
                if (grant != null && grant > 0) {
                    jdbcTemplate.update("""
                            INSERT INTO user_ai_token_wallets (user_id, balance, updated_at)
                            VALUES (?, ?, NOW())
                            """, userId, grant);
                    log.info("[WALLET] Seeded wallet balance={} for userId={}", grant, userId);
                }
            }
        }
    }
}
