-- V222 — Performance: index on users.org_id for org quota SUM query (S-3).
-- OrgQuotaService.orgUsageThisMonth() joins ai_token_usage_events with users WHERE u.org_id = ?;
-- without this index each AI request for an org user scans the full users table.
-- Partial index (WHERE org_id IS NOT NULL) keeps it small — only org-affiliated rows are indexed.
CREATE INDEX IF NOT EXISTS idx_users_org_id
    ON users (org_id)
    WHERE org_id IS NOT NULL;
