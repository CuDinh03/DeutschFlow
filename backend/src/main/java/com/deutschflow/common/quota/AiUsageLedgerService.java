package com.deutschflow.common.quota;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class AiUsageLedgerService {

    private final JdbcTemplate jdbcTemplate;
    private final QuotaService quotaService;

    @Transactional(rollbackFor = Exception.class)
    public void recordStt(Long userId, String feature, String model, double durationSeconds) {
        jdbcTemplate.update("""
                        INSERT INTO stt_usage_events (user_id, feature, model, audio_duration_secs)
                        VALUES (?, ?, ?, ?)
                        """,
                userId, feature, model, durationSeconds);
    }

    @Transactional(rollbackFor = Exception.class)
    public void record(long userId,
                       String provider,
                       String model,
                       int promptTokens,
                       int completionTokens,
                       int totalTokens,
                       String feature,
                       String requestId,
                       Long sessionId) {
        // Capture org_id at event time via subquery (D-2) — single round-trip, no separate lookup.
        jdbcTemplate.update("""
                        INSERT INTO ai_token_usage_events (
                          user_id, org_id, provider, model,
                          prompt_tokens, completion_tokens, total_tokens,
                          feature, request_id, session_id
                        )
                        SELECT ?, u.org_id, ?, ?, ?, ?, ?, ?, ?, ?
                        FROM users u WHERE u.id = ?
                        """,
                userId, provider, model,
                promptTokens, completionTokens, totalTokens,
                feature, requestId, sessionId,
                userId
        );

        // S-3/P-10: atomically increment monthly counter for org (no-op for B2C users with org_id IS NULL).
        // ON CONFLICT DO UPDATE is atomic — avoids the race that SUM(ledger) has.
        jdbcTemplate.update("""
                        INSERT INTO org_monthly_token_counters (org_id, month_start, tokens_used)
                        SELECT u.org_id,
                               date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
                               ?
                        FROM users u WHERE u.id = ? AND u.org_id IS NOT NULL
                        ON CONFLICT (org_id, month_start)
                        DO UPDATE SET tokens_used = org_monthly_token_counters.tokens_used + EXCLUDED.tokens_used
                        """,
                totalTokens, userId
        );

        quotaService.applyUsageDebit(userId, totalTokens, Instant.now());
    }
}
