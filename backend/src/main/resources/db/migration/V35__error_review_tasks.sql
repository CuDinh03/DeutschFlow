-- Phase 2: spaced review tasks for error repair loop
CREATE TABLE error_review_tasks  (
    id BIGSERIAL,
    user_id BIGINT NOT NULL,
    error_code VARCHAR(80) NOT NULL,
    task_type VARCHAR(32) NOT NULL,
    due_at TIMESTAMP(6) NOT NULL,
    interval_days INT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP(6) NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_ert_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ert_user_due ON error_review_tasks (user_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_ert_user_code ON error_review_tasks (user_id, error_code);
