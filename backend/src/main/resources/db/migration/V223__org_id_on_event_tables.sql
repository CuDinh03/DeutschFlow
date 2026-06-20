-- V223 — D-2: add org_id to business tables for direct tenant filtering.
-- Avoids JOIN through users/org_members when querying usage per org.
-- Nullable (B2C events have no org; backfill via current users.org_id snapshot).

ALTER TABLE ai_token_usage_events  ADD COLUMN IF NOT EXISTS org_id BIGINT REFERENCES organizations(id);
ALTER TABLE ai_speaking_sessions   ADD COLUMN IF NOT EXISTS org_id BIGINT REFERENCES organizations(id);

-- Backfill existing rows using users.org_id (current snapshot — close enough at 10 centers).
UPDATE ai_token_usage_events e
SET    org_id = u.org_id
FROM   users u
WHERE  u.id = e.user_id
  AND  u.org_id IS NOT NULL
  AND  e.org_id IS NULL;

UPDATE ai_speaking_sessions s
SET    org_id = u.org_id
FROM   users u
WHERE  u.id = s.user_id
  AND  u.org_id IS NOT NULL
  AND  s.org_id IS NULL;

-- Index on (org_id, created_at) enables the monthly-SUM query to be an index-range scan
-- instead of a full-table SUM (critical once event volume grows).
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_org_month
    ON ai_token_usage_events (org_id, created_at)
    WHERE org_id IS NOT NULL;
