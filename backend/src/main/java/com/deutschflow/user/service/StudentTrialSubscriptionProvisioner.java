package com.deutschflow.user.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;

/**
 * New students receive a bounded FREE trial ({@code plan_code FREE}, 7 calendar days rolling from {@code ends_at})
 * enforced by quota reconciliation.
 */
@Service
@RequiredArgsConstructor
public class StudentTrialSubscriptionProvisioner {

    private static final String FREE = "FREE";

    private final JdbcTemplate jdbcTemplate;

    public void provisionSevenDayTrial(long userId, Instant trialStart, Instant trialEnd) {
        try {
            jdbcTemplate.update("""
                            INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, ends_at)
                            VALUES (?, ?, 'ACTIVE', ?, ?)
                            ON DUPLICATE KEY UPDATE
                                plan_code = VALUES(plan_code),
                                status = VALUES(status),
                                starts_at = VALUES(starts_at),
                                ends_at = VALUES(ends_at)
                            """,
                    userId, FREE, Timestamp.from(trialStart), Timestamp.from(trialEnd));
        } catch (Exception e) {
            System.err.println("⚠️ Failed to provision trial subscription for user " + userId + ": " + e.getMessage());
            throw e;
        }
    }
}
