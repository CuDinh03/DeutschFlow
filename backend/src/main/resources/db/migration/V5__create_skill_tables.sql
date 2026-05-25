-- ============================================================
-- V5: MODULE SKILL
-- ============================================================

CREATE TABLE skill_exercises  (
    id         BIGSERIAL PRIMARY KEY,
    skill_type VARCHAR(64) NOT NULL,
    word_id    BIGINT,
    pattern_id BIGINT,
    content    TEXT        NOT NULL,
    audio_url  VARCHAR(500),
    difficulty VARCHAR(64) NOT NULL DEFAULT 'A1',
    created_by BIGINT      NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (word_id)    REFERENCES words(id)             ON DELETE SET NULL,
    FOREIGN KEY (pattern_id) REFERENCES sentence_patterns(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)             ON DELETE RESTRICT
);


CREATE TABLE user_skill_results  (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT       NOT NULL,
    exercise_id  BIGINT       NOT NULL,
    score        DECIMAL(5,2),
    ai_feedback  TEXT,
    completed_at TIMESTAMP(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)     REFERENCES users(id)           ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES skill_exercises(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_skill_history ON user_skill_results (user_id, completed_at);
