-- Adaptive loop: per-user rolling metrics + difficulty + cooldowns for speaking personalization
CREATE TABLE speaking_user_state (
    user_id BIGINT NOT NULL PRIMARY KEY,
    rolling_accuracy_pct DECIMAL(5, 2) NOT NULL DEFAULT 100.00,
    rolling_window INT NOT NULL DEFAULT 8,
    difficulty_knob SMALLINT NOT NULL DEFAULT 0,
    current_focus_codes_json JSON NULL,
    cooldown_codes_json JSON NULL,
    last_topic VARCHAR(200) NULL,
    last_topic_at TIMESTAMP NULL,
    last_evaluated_turn_id BIGINT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_speaking_user_state_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
