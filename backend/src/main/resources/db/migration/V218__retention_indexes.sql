-- V218: Standalone time-column indexes to make nightly retention deletes fast.
-- The unbounded event tables (telemetry/xp/token ledger) grow on every request/activity/AI call.
-- DataRetentionJob purges old rows by time; without a standalone index on the time column the
-- range-delete falls back to a full scan. api_telemetry_events already has idx_api_telemetry_event_time
-- (V18); xp + token-usage only have composite indexes that LEAD with user_id, so add standalone ones.

CREATE INDEX IF NOT EXISTS idx_user_xp_events_created_at
    ON user_xp_events (created_at);

CREATE INDEX IF NOT EXISTS idx_ai_token_usage_created_at
    ON ai_token_usage_events (created_at);
