-- ============================================================
-- V14: Track what user has learned (session progress)
-- ============================================================

CREATE TABLE learning_session_progress  (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL,
    week_number   INT NOT NULL,
    session_index INT NOT NULL,
    status        VARCHAR(64) NOT NULL DEFAULT 'NOT_STARTED',
    ability_score DOUBLE PRECISION,
    time_seconds  DOUBLE PRECISION,
    completed_at  TIMESTAMP(6),
    created_at    TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_week_session UNIQUE (user_id, week_number, session_index),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_status ON learning_session_progress (user_id, status);
