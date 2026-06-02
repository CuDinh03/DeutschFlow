package com.deutschflow.user.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;

/**
 * New students receive a 7-day PRO trial ({@code plan_code PRO}) so they experience all features
 * before deciding whether to subscribe.
 */
@Service
@RequiredArgsConstructor
public class StudentTrialSubscriptionProvisioner {

    private static final String PRO = "PRO";

    private final JdbcTemplate jdbcTemplate;

    public void provisionSevenDayTrial(long userId, Instant trialStart, Instant trialEnd) {
        try {
            // PostgreSQL: user_subscriptions has no UNIQUE on user_id, so the previous MySQL
            // ON DUPLICATE KEY UPDATE never actually upserted — it inserted. Preserve that intent
            // idempotently with a NOT EXISTS guard (grant the trial only if no active sub exists).
            jdbcTemplate.update("""
                            INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, ends_at)
                            SELECT ?, ?, 'ACTIVE', ?, ?
                            WHERE NOT EXISTS (
                                SELECT 1 FROM user_subscriptions WHERE user_id = ? AND status = 'ACTIVE'
                            )
                            """,
                    userId, PRO, Timestamp.from(trialStart), Timestamp.from(trialEnd), userId);
        } catch (Exception e) {
            System.err.println("⚠️ Failed to provision trial subscription for user " + userId + ": " + e.getMessage());
            throw e;
        }
    }
}
