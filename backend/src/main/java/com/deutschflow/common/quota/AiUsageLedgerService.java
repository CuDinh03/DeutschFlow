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
    public void record(long userId,
                       String provider,
                       String model,
                       int promptTokens,
                       int completionTokens,
                       int totalTokens,
                       String feature,
                       String requestId,
                       Long sessionId) {
        jdbcTemplate.update("""
                        INSERT INTO ai_token_usage_events (
                          user_id, provider, model,
                          prompt_tokens, completion_tokens, total_tokens,
                          feature, request_id, session_id
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                userId, provider, model,
                promptTokens, completionTokens, totalTokens,
                feature, requestId, sessionId
        );
        quotaService.applyUsageDebit(userId, totalTokens, Instant.now());
    }
}

