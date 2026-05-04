-- Phase 1: normalized observations + skill aggregates (dual-write with user_grammar_errors)
CREATE TABLE user_error_observations  (
    id BIGSERIAL,
    user_id BIGINT NOT NULL,
    message_id BIGINT NOT NULL,
    session_id BIGINT NOT NULL,
    error_code VARCHAR(80) NOT NULL,
    severity VARCHAR(16) NOT NULL,
    confidence DECIMAL(4,3) NULL,
    wrong_span VARCHAR(500) NULL,
    corrected_span VARCHAR(500) NULL,
    rule_vi_short VARCHAR(500) NULL,
    example_correct_de VARCHAR(500) NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_obs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_obs_session FOREIGN KEY (session_id) REFERENCES ai_speaking_sessions (id) ON DELETE CASCADE,
    CONSTRAINT fk_obs_message FOREIGN KEY (message_id) REFERENCES ai_speaking_messages (id) ON DELETE CASCADE,
    CONSTRAINT uk_obs_message_code UNIQUE (message_id, error_code)
);
CREATE INDEX IF NOT EXISTS idx_obs_user_code_created ON user_error_observations (user_id, error_code, created_at DESC);


CREATE TABLE user_error_skills  (
    id BIGSERIAL,
    user_id BIGINT NOT NULL,
    error_code VARCHAR(80) NOT NULL,
    total_count INT NOT NULL DEFAULT 0,
    last_seen_at TIMESTAMP(6) NOT NULL,
    last_severity VARCHAR(16) NOT NULL,
    open_count INT NOT NULL DEFAULT 0,
    resolved_count INT NOT NULL DEFAULT 0,
    priority_score DECIMAL(8,3) NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    CONSTRAINT uk_skill_user_code UNIQUE (user_id, error_code),
    CONSTRAINT fk_skill_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_skill_user_priority ON user_error_skills (user_id, priority_score DESC);


-- Backfill skills from historical grammar errors (one row per user + code)
INSERT INTO user_error_skills (user_id, error_code, total_count, last_seen_at, last_severity, open_count, resolved_count, priority_score)
SELECT agg.user_id,
       agg.code,
       agg.cnt,
       agg.last_created,
       'MINOR',
       agg.open_cnt,
       agg.resolved_cnt,
       1.000
FROM (
         SELECT user_id,
                COALESCE(NULLIF(TRIM(error_code), ''), grammar_point) AS code,
                COUNT(*) AS cnt,
                MAX(created_at) AS last_created,
                SUM(CASE WHEN repair_status = 'OPEN' THEN 1 ELSE 0 END) AS open_cnt,
                SUM(CASE WHEN repair_status = 'RESOLVED' THEN 1 ELSE 0 END) AS resolved_cnt
         FROM user_grammar_errors
         GROUP BY user_id, COALESCE(NULLIF(TRIM(error_code), ''), grammar_point)
     ) agg
WHERE agg.code IS NOT NULL
  AND TRIM(agg.code) <> '';
