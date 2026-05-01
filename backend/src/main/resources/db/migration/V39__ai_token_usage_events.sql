-- Ledger of AI token usage events for quota enforcement and reporting
CREATE TABLE ai_token_usage_events (
    id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
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
    INDEX idx_ai_usage_user_time (user_id, created_at DESC),
    INDEX idx_ai_usage_feature_time (feature, created_at DESC),
    CONSTRAINT fk_ai_usage_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

