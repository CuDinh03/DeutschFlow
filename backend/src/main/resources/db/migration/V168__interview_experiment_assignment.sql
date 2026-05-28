-- A/B experiment assignments for interview sessions
CREATE TABLE IF NOT EXISTS interview_experiment_assignment (
    id              BIGSERIAL    PRIMARY KEY,
    user_id         BIGINT       NOT NULL,
    session_id      BIGINT       REFERENCES ai_speaking_sessions(id) ON DELETE SET NULL,
    experiment_key  VARCHAR(100) NOT NULL,   -- e.g. "interview_prompt_v2", "rubric_weight_test"
    variant_key     VARCHAR(50)  NOT NULL,   -- e.g. "control", "variant_b", "variant_c"
    assigned_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
    reason          VARCHAR(200)             -- e.g. "hash_bucket:42", "forced:admin"
);

CREATE INDEX IF NOT EXISTS idx_iea_user_exp ON interview_experiment_assignment (user_id, experiment_key);
CREATE INDEX IF NOT EXISTS idx_iea_session  ON interview_experiment_assignment (session_id);
