-- Add versioning linkage to ai_speaking_sessions for interview artifact reproducibility.
-- Fixes the gap identified in the design critique: sessions must link to the exact
-- persona version and rubric template used at runtime.
ALTER TABLE ai_speaking_sessions
    ADD COLUMN IF NOT EXISTS interview_persona_version   INT,
    ADD COLUMN IF NOT EXISTS interview_rubric_template_id BIGINT REFERENCES interview_rubric_template(id),
    ADD COLUMN IF NOT EXISTS interview_experiment_key    VARCHAR(100),
    ADD COLUMN IF NOT EXISTS interview_prompt_variant    VARCHAR(50);
