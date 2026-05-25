-- ============================================================
-- V54: Track summarized user learning progress
-- ============================================================

CREATE TABLE user_learning_progress (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL UNIQUE,
    last_error_type VARCHAR(255),
    updated_at      TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_learning_progress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
