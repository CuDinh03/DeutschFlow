-- ============================================================
-- V15: Track theory view + exercise attempts + mistakes
-- ============================================================

CREATE TABLE learning_session_state (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id       BIGINT NOT NULL,
    week_number   INT NOT NULL,
    session_index INT NOT NULL,
    theory_viewed TINYINT(1) NOT NULL DEFAULT 0,
    started_at    DATETIME(6),
    last_seen_at  DATETIME(6),
    created_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_state_user_week_session (user_id, week_number, session_index),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE learning_session_attempts (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id       BIGINT NOT NULL,
    week_number   INT NOT NULL,
    session_index INT NOT NULL,
    attempt_no    INT NOT NULL,
    score_percent INT NOT NULL,
    mistakes_json JSON,
    created_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_attempt_user_week_session_no (user_id, week_number, session_index, attempt_no),
    INDEX idx_attempt_user_week_session (user_id, week_number, session_index),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

