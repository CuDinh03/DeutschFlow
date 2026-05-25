-- Weekly themed speaking prompts + graded submissions (4-axis rubric: Erfüllung, Flüssigkeit,
-- Wortschatz, Grammatik). Aligns with weekly_theme_rubric roadmap.

CREATE TABLE weekly_speaking_prompts  (
    id BIGSERIAL,
    week_start_date DATE NOT NULL,
    cefr_band VARCHAR(8) NOT NULL,
    title VARCHAR(280) NOT NULL,
    prompt_de TEXT NOT NULL,
    mandatory_points_json JSONB NOT NULL,
    optional_points_json JSONB NULL,
    prompt_version VARCHAR(32) NOT NULL DEFAULT 'v1',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_wsp_week_cefr UNIQUE (week_start_date, cefr_band)
);
CREATE INDEX IF NOT EXISTS idx_wsp_week_active ON weekly_speaking_prompts (week_start_date, is_active);


CREATE TABLE weekly_speaking_submissions  (
    id BIGSERIAL,
    user_id BIGINT NOT NULL,
    prompt_id BIGINT NOT NULL,
    transcript_text TEXT NOT NULL,
    audio_duration_sec DECIMAL(8, 2) NULL,
    rubric_payload_json JSONB NULL,
    grammar_errors_extracted_json JSONB NULL,
    model_used VARCHAR(128) NULL,
    rubric_prompt_version VARCHAR(32) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_wss_user_prompt UNIQUE (user_id, prompt_id),
    CONSTRAINT fk_wss_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_wss_prompt FOREIGN KEY (prompt_id) REFERENCES weekly_speaking_prompts (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_wss_prompt ON weekly_speaking_submissions (prompt_id);
