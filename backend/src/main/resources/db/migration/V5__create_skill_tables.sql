-- ============================================================
-- V5: MODULE SKILL
-- ============================================================

CREATE TABLE skill_exercises (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    skill_type ENUM('LISTENING','SPEAKING','READING') NOT NULL,
    word_id    BIGINT,
    pattern_id BIGINT,
    content    TEXT        NOT NULL,
    audio_url  VARCHAR(500),
    difficulty ENUM('A1','A2','B1','B2','C1','C2') NOT NULL DEFAULT 'A1',
    created_by BIGINT      NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (word_id)    REFERENCES words(id)             ON DELETE SET NULL,
    FOREIGN KEY (pattern_id) REFERENCES sentence_patterns(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)             ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_skill_results (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id      BIGINT       NOT NULL,
    exercise_id  BIGINT       NOT NULL,
    score        DECIMAL(5,2),
    ai_feedback  TEXT,
    completed_at DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    FOREIGN KEY (user_id)     REFERENCES users(id)           ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES skill_exercises(id) ON DELETE CASCADE,
    INDEX idx_skill_history (user_id, completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
