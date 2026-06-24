package com.deutschflow.common.quota;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

/**
 * Background reconciler for user subscription lifecycle (S-4).
 *
 * <p>Keeps the hot-path ({@code QuotaService.assertAllowed}) read-only by handling subscription
 * state writes asynchronously: setting FREE trial {@code ends_at}, ending expired subscriptions,
 * and provisioning DEFAULT when no active plan exists.
 *
 * <p>Runs every 10 minutes — well within the 7-day FREE trial window, so the virtual expiry
 * check in {@code assertAllowed} is only a transient safety net.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SubscriptionReconcileJob {

    private final JdbcTemplate jdbcTemplate;
    private final QuotaService quotaService;

    @Scheduled(cron = "0 */10 * * * *")
    @SchedulerLock(name = "subscriptionReconcile", lockAtMostFor = "PT9M", lockAtLeastFor = "PT0S")
    public void reconcileStaleSubscriptions() {
        Instant now = Instant.now();

        // Users with subscriptions that likely need reconciliation:
        // - FREE with no ends_at (trial never got expiry set)
        // - FREE with expired ends_at still ACTIVE
        // - PRO/ULTRA past their 30-day period (may need ENDED if wallet empty)
        List<Long> userIds = jdbcTemplate.queryForList("""
                SELECT DISTINCT user_id FROM user_subscriptions
                WHERE status = 'ACTIVE'
                  AND (
                    (plan_code = 'FREE' AND (ends_at IS NULL OR ends_at <= ?))
                    OR (plan_code IN ('PRO', 'ULTRA') AND ends_at IS NOT NULL AND ends_at <= ?)
                  )
                LIMIT 500
                """, Long.class, Timestamp.from(now), Timestamp.from(now));

        if (userIds.isEmpty()) {
            return;
        }

        int succeeded = 0;
        int failed = 0;
        for (Long userId : userIds) {
            try {
                quotaService.reconcileForUser(userId, now);
                succeeded++;
            } catch (Exception e) {
                log.warn("[SubscriptionReconcileJob] userId={}: {}", userId, e.getMessage());
                failed++;
            }
        }
        log.info("[SubscriptionReconcileJob] Reconciled {}/{} subscriptions ({} failed)",
                succeeded, userIds.size(), failed);
    }
}
