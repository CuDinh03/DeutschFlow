-- S-3 full / P-10: replace SUM(ledger) with an atomic per-org-per-month counter.
-- Reads become O(1) PK lookup instead of O(n ledger rows).
-- Writes atomically increment via ON CONFLICT DO UPDATE — no race between concurrent AI calls.

CREATE TABLE org_monthly_token_counters (
    org_id     BIGINT  NOT NULL REFERENCES organizations(id),
    month_start DATE   NOT NULL,
    tokens_used BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (org_id, month_start)
);

-- Backfill from existing events (uses VN timezone, same as orgUsageThisMonth query).
INSERT INTO org_monthly_token_counters (org_id, month_start, tokens_used)
SELECT
    org_id,
    date_trunc('month', created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS month_start,
    SUM(total_tokens)
FROM ai_token_usage_events
WHERE org_id IS NOT NULL
GROUP BY org_id,
         date_trunc('month', created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
ON CONFLICT (org_id, month_start) DO UPDATE
    SET tokens_used = EXCLUDED.tokens_used;
