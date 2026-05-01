-- Ledger of AI token usage events for quota enforcement and reporting
CREATE TABLE ai_token_usage_events  (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    provider VARCHAR(16) NOT NULL,
    model VARCHAR(128) NULL,
    prompt_tokens INT NOT NULL,
    completion_tokens INT NOT NULL,
    total_tokens INT NOT NULL,
    feature VARCHAR(32) NOT NULL,
    request_id VARCHAR(64) NULL,
    session_id BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ai_usage_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_time ON ai_token_usage_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature_time ON ai_token_usage_events (feature, created_at DESC);
