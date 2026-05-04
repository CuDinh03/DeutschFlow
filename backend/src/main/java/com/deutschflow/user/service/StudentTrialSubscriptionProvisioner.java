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
        jdbcTemplate.update("""
                        INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, ends_at)
                        VALUES (?, ?, 'ACTIVE', ?, ?)
                        """,
                userId, FREE, Timestamp.from(trialStart), Timestamp.from(trialEnd));
    }
}
