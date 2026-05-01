-- Phase 2: spaced review tasks for error repair loop
CREATE TABLE error_review_tasks (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    error_code VARCHAR(80) NOT NULL,
    task_type VARCHAR(32) NOT NULL,
    due_at DATETIME(6) NOT NULL,
    interval_days INT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    completed_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    KEY idx_ert_user_due (user_id, status, due_at),
    KEY idx_ert_user_code (user_id, error_code),
    CONSTRAINT fk_ert_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
