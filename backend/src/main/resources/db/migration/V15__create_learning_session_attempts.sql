-- ============================================================
-- V15: Track theory view + exercise attempts + mistakes
-- ============================================================

CREATE TABLE learning_session_state  (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL,
    week_number   INT NOT NULL,
    session_index INT NOT NULL,
    theory_viewed BOOLEAN NOT NULL DEFAULT FALSE,
    started_at    TIMESTAMP(6),
    last_seen_at  TIMESTAMP(6),
    created_at    TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_state_user_week_session UNIQUE (user_id, week_number, session_index),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


CREATE TABLE learning_session_attempts  (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL,
    week_number   INT NOT NULL,
    session_index INT NOT NULL,
    attempt_no    INT NOT NULL,
    score_percent INT NOT NULL,
    mistakes_json JSON,
    created_at    TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_attempt_user_week_session_no UNIQUE (user_id, week_number, session_index, attempt_no),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_attempt_user_week_session ON learning_session_attempts (user_id, week_number, session_index);
