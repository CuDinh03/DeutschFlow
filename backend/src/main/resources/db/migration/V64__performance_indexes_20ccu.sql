-- ============================================================
-- V64: Performance indexes for 20 CCU optimization
-- Targets: speaking sessions, grammar errors, SRS items, XP, token usage, session progress
-- Uses CREATE INDEX IF NOT EXISTS for idempotency
-- ============================================================

-- Speaking sessions: admin detail, user history
CREATE INDEX IF NOT EXISTS idx_ai_speaking_sessions_user_started
    ON ai_speaking_sessions(user_id, started_at DESC);

-- Speaking messages: session message loading
CREATE INDEX IF NOT EXISTS idx_ai_speaking_messages_session_created
    ON ai_speaking_messages(session_id, created_at ASC);

-- Grammar errors: weak points aggregation, recent errors
CREATE INDEX IF NOT EXISTS idx_user_grammar_errors_user_created
    ON user_grammar_errors(user_id, created_at DESC);

-- SRS review items: due today queries, user counts
CREATE INDEX IF NOT EXISTS idx_learning_review_items_user_due
    ON learning_review_items(user_id, due_at);

-- XP events: leaderboard, summary queries
CREATE INDEX IF NOT EXISTS idx_user_xp_events_user_created
    ON user_xp_events(user_id, created_at DESC);

-- Token usage: admin reports, quota checks
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_user_created
    ON ai_token_usage_events(user_id, created_at DESC);

-- Session progress: streak calculation (hot query)
CREATE INDEX IF NOT EXISTS idx_learning_session_progress_user_status
    ON learning_session_progress(user_id, status, completed_at DESC);
