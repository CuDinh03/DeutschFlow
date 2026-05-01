-- Weekly themed speaking prompts + graded submissions (4-axis rubric: Erfüllung, Flüssigkeit,
-- Wortschatz, Grammatik). Aligns with weekly_theme_rubric roadmap.

CREATE TABLE weekly_speaking_prompts (
    id BIGINT NOT NULL AUTO_INCREMENT,
    week_start_date DATE NOT NULL COMMENT 'VN Monday anchor (calendar date in Asia/Ho_Chi_Minh).',
    cefr_band VARCHAR(8) NOT NULL COMMENT 'Target band e.g. A2, B1, B2.',
    title VARCHAR(280) NOT NULL,
    prompt_de MEDIUMTEXT NOT NULL COMMENT 'Exam-style task wording in German.',
    mandatory_points_json JSON NOT NULL COMMENT 'JSON array of bullets that must be covered for Erfüllung scoring.',
    optional_points_json JSON NULL COMMENT 'Optional expectations (lighter weight).',
    prompt_version VARCHAR(32) NOT NULL DEFAULT 'v1',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_wsp_week_cefr (week_start_date, cefr_band),
    KEY idx_wsp_week_active (week_start_date, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE weekly_speaking_submissions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    prompt_id BIGINT NOT NULL,
    transcript_text MEDIUMTEXT NOT NULL,
    audio_duration_sec DECIMAL(8, 2) NULL COMMENT 'Seconds of audio – optional heuristic for fluency/WPM.',
    rubric_payload_json JSON NULL COMMENT 'Full graded JSON from model + deterministic merge.',
    grammar_errors_extracted_json JSON NULL COMMENT 'Copy of grammar.errors[] for dashboards.',
    model_used VARCHAR(128) NULL,
    rubric_prompt_version VARCHAR(32) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_wss_user_prompt (user_id, prompt_id),
    KEY idx_wss_prompt (prompt_id),
    CONSTRAINT fk_wss_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_wss_prompt FOREIGN KEY (prompt_id) REFERENCES weekly_speaking_prompts (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
