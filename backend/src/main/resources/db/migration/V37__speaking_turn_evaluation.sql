-- Per assistant-turn evaluation for adaptive difficulty and rolling accuracy
CREATE TABLE speaking_turn_evaluation (
    turn_id BIGINT NOT NULL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    session_id BIGINT NOT NULL,
    error_count INT NOT NULL DEFAULT 0,
    major_plus_count INT NOT NULL DEFAULT 0,
    focus_hit TINYINT(1) NOT NULL DEFAULT 0,
    difficulty_at_turn SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_speaking_turn_eval_user_created (user_id, created_at DESC),
    CONSTRAINT fk_speaking_turn_eval_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
