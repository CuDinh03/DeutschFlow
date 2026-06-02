package com.deutschflow.payment.service;

import com.deutschflow.notification.service.UserNotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

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
                source,
                Timestamp.from(now), Timestamp.from(now));
        log.info("[SUB] Activated plan={} for userId={} source={} until={}", planCode, userId, source, endsAt);

        // 3. Seed AI token wallet for PRO/ULTRA (idempotent)
        seedWalletIfNeeded(userId, planCode);

        // 4. Notify admins (skipped on silent renewals)
        if (notifyAdmins) {
            userNotificationService.onLearnerSubscribed(userId, planCode);
        }
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
        } else {
            activateWithExplicitEnd(userId, planCode, startsAt, endsAt, "APPLE", notifyAdmins);
        }
    }

    /** Ends the user's Apple-originated entitlement (refund / expire / revoke). Leaves web Stripe/MoMo rows untouched. */
    @Transactional
    public void endAppleSubscription(Long userId) {
        int ended = jdbcTemplate.update("""
                UPDATE user_subscriptions
                SET status = 'ENDED', updated_at = ?
                WHERE user_id = ? AND source = 'APPLE' AND status = 'ACTIVE'
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
