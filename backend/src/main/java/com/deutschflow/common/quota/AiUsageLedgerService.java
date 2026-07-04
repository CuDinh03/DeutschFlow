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

    /**
     * Token-tương-đương cho mỗi giây audio STT. Whisper bị Groq tính theo giây (không theo
     * token), nên để STT cũng trừ vào org token pool + ví người dùng như các tính năng token
     * khác (audit M-3: trước đây STT KHÔNG trừ gì → org metered chạy Speaking "miễn phí" với
     * pool). Hiệu chỉnh để 1 clip ~10s ≈ {@code STT_ESTIMATED_TOKENS} (200) mà OrgPoolGuard
     * dùng ở bước pre-check gate.
     */
    private static final long STT_TOKENS_PER_SECOND = 20L;

    @Transactional(rollbackFor = Exception.class)
    public void recordStt(Long userId, String feature, String model, double durationSeconds) {
        jdbcTemplate.update("""
                        INSERT INTO stt_usage_events (user_id, feature, model, audio_duration_secs)
                        VALUES (?, ?, ?, ?)
                        """,
                userId, feature, model, durationSeconds);

        // B2B-COGS (audit M-3): quy giây audio → token-tương-đương và trừ vào org pool + ví,
        // giống record(). No-op cho user không thuộc org (pool) / plan không có ví.
        if (userId != null && durationSeconds > 0) {
            chargeOrgPoolAndWallet(userId, Math.round(durationSeconds * STT_TOKENS_PER_SECOND));
        }
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

        chargeOrgPoolAndWallet(userId, totalTokens);
    }

    /**
     * Trừ {@code totalTokens} vào bộ đếm token tháng cấp-org và ví rollover của user.
     * Dùng chung cho {@link #record} (tính năng token) và {@link #recordStt} (STT).
     *
     * <ul>
     *   <li>Bộ đếm org: no-op cho user B2C (org_id IS NULL). ON CONFLICT DO UPDATE là atomic —
     *       tránh race của SUM(ledger) (S-3/P-10).</li>
     *   <li>Ví: {@link QuotaService#applyUsageDebit} tự no-op cho plan không phải ví (FREE/INTERNAL).</li>
     * </ul>
     */
    private void chargeOrgPoolAndWallet(long userId, long totalTokens) {
        if (totalTokens <= 0) {
            return;
        }
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
