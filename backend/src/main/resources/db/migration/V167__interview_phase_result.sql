-- Per-phase evaluation results for interview sessions
CREATE TABLE IF NOT EXISTS interview_phase_result (
    id                     BIGSERIAL    PRIMARY KEY,
    session_id             BIGINT       NOT NULL REFERENCES ai_speaking_sessions(id) ON DELETE CASCADE,
    phase                  VARCHAR(30)  NOT NULL,
    score                  NUMERIC(4,2),              -- 0.00 – 10.00
    rubric_template_id     BIGINT       REFERENCES interview_rubric_template(id),
    weights_json           TEXT,                      -- snapshot of weights used (for reproducibility)
    strengths_json         TEXT,                      -- JSON array of strength strings (Vietnamese)
    weaknesses_json        TEXT,                      -- JSON array of weakness strings (Vietnamese)
    recommended_drill_json TEXT,                      -- JSON array of recommended drill strings
    created_at             TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE (session_id, phase)
);

CREATE INDEX IF NOT EXISTS idx_ipr_session ON interview_phase_result (session_id);
