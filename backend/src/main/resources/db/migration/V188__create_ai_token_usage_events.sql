-- ============================================================
-- V188: Create ai_token_usage_events (AI token-usage ledger)
-- ============================================================
-- This table is the quota ledger that gates ALL AI features. It was previously
-- created out-of-band (no migration / no entity), so a from-scratch DB (CI, new
-- dev, fresh prod) had no table and AI calls failed at the quota check.
-- Schema derived from AiUsageLedgerService (writes) + QuotaService / AdminManagementService (reads).

CREATE TABLE IF NOT EXISTS ai_token_usage_events (
    id                BIGSERIAL    PRIMARY KEY,
    user_id           BIGINT       NOT NULL,
    provider          VARCHAR(32),
    model             VARCHAR(64),
    prompt_tokens     INTEGER      NOT NULL DEFAULT 0,
    completion_tokens INTEGER      NOT NULL DEFAULT 0,
    total_tokens      INTEGER      NOT NULL DEFAULT 0,
    feature           VARCHAR(64),
    request_id        VARCHAR(64),
    session_id        BIGINT,
    created_at        TIMESTAMP    NOT NULL DEFAULT now()
);

-- Quota check (sum per user within VN-day window) + admin reports.
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_user_created
    ON ai_token_usage_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_feature
    ON ai_token_usage_events (feature, created_at DESC);
