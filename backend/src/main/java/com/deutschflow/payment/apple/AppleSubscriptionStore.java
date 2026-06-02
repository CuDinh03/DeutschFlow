package com.deutschflow.payment.apple;

import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Data access for the Apple-side subscription ledger ({@code apple_subscriptions}) and per-user
 * {@code appAccountToken} correlation. The ledger lets App Store Server Notifications V2 (which carry
 * only Apple identifiers) be traced back to a DeutschFlow user.
 */
@Repository
@Slf4j
public class AppleSubscriptionStore {

    private final JdbcTemplate jdbcTemplate;

    public AppleSubscriptionStore(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Idempotent upsert keyed by {@code originalTransactionId}. On conflict, {@code expires_at} only moves
     * forward (GREATEST) so a stale/duplicate notification cannot shorten the record; {@code user_id} is
     * never overwritten so the first correlation wins.
     */
    public void upsert(String originalTransactionId, Long userId, String productId, String planCode,
                       String status, Instant expiresAt, Boolean autoRenewStatus,
                       String environment, String latestTransactionId) {
        jdbcTemplate.update("""
                INSERT INTO apple_subscriptions
                    (original_transaction_id, user_id, product_id, plan_code, status, expires_at,
                     auto_renew_status, environment, latest_transaction_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                ON CONFLICT (original_transaction_id) DO UPDATE SET
                    product_id            = EXCLUDED.product_id,
                    plan_code             = EXCLUDED.plan_code,
                    status                = EXCLUDED.status,
                    expires_at            = GREATEST(apple_subscriptions.expires_at, EXCLUDED.expires_at),
                    auto_renew_status     = COALESCE(EXCLUDED.auto_renew_status, apple_subscriptions.auto_renew_status),
                    environment           = EXCLUDED.environment,
                    latest_transaction_id = EXCLUDED.latest_transaction_id,
                    updated_at            = NOW()
                """,
                originalTransactionId, userId, productId, planCode, status,
                expiresAt != null ? Timestamp.from(expiresAt) : null,
                autoRenewStatus, environment, latestTransactionId);
    }

    /** Flip only the lifecycle status (terminal events: EXPIRED / REFUNDED / REVOKED). */
    public void markStatus(String originalTransactionId, String status) {
        jdbcTemplate.update("""
                UPDATE apple_subscriptions SET status = ?, updated_at = NOW()
                WHERE original_transaction_id = ?
                """, status, originalTransactionId);
    }

    /** Update only the auto-renew flag (DID_CHANGE_RENEWAL_STATUS). */
    public void updateAutoRenew(String originalTransactionId, boolean autoRenew) {
        jdbcTemplate.update("""
                UPDATE apple_subscriptions SET auto_renew_status = ?, updated_at = NOW()
                WHERE original_transaction_id = ?
                """, autoRenew, originalTransactionId);
    }

    public Optional<Long> findUserIdByOriginalTransactionId(String originalTransactionId) {
        List<Long> rows = jdbcTemplate.query(
                "SELECT user_id FROM apple_subscriptions WHERE original_transaction_id = ?",
                (rs, n) -> rs.getLong("user_id"), originalTransactionId);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    public Optional<Long> findUserIdByAppAccountToken(UUID appAccountToken) {
        if (appAccountToken == null) {
            return Optional.empty();
        }
        List<Long> rows = jdbcTemplate.query(
                "SELECT id FROM users WHERE apple_app_account_token = ?",
                (rs, n) -> rs.getLong("id"), appAccountToken);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    /**
     * Returns the user's stable appAccountToken, generating and persisting one on first use. The claim is
     * atomic — the conditional UPDATE only sets a token when none exists, so concurrent callers can never
     * end up with divergent tokens (the first writer wins; everyone re-reads the winner's value).
     */
    @Transactional
    public UUID getOrCreateAppAccountToken(Long userId) {
        UUID candidate = UUID.randomUUID();
        jdbcTemplate.update(
                "UPDATE users SET apple_app_account_token = ? WHERE id = ? AND apple_app_account_token IS NULL",
                candidate, userId);
        List<UUID> rows = jdbcTemplate.query(
                "SELECT apple_app_account_token FROM users WHERE id = ?",
                (rs, n) -> rs.getObject("apple_app_account_token", UUID.class), userId);
        if (rows.isEmpty() || rows.get(0) == null) {
            throw new IllegalStateException("Cannot resolve appAccountToken for userId=" + userId);
        }
        return rows.get(0);
    }

    /**
     * Records a processed App Store Server Notification UUID. Returns {@code true} when newly recorded and
     * {@code false} on duplicate delivery — the exactly-once guard for Apple's at-least-once notifications.
     */
    public boolean markNotificationProcessedIfNew(String notificationUuid, String notificationType) {
        if (notificationUuid == null || notificationUuid.isBlank()) {
            return true; // nothing to dedupe on — let the caller process it
        }
        int inserted = jdbcTemplate.update("""
                INSERT INTO apple_processed_notifications (notification_uuid, notification_type)
                VALUES (?, ?)
                ON CONFLICT (notification_uuid) DO NOTHING
                """, notificationUuid, notificationType);
        return inserted > 0;
    }
}
