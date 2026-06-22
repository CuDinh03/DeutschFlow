-- PROMPT 6: per-criterion grading rubric + AI self-confidence on assignment submissions.
-- Additive + nullable — the existing single-score path is unchanged; these columns are populated by
-- AI grading only when the model returns a criteria breakdown / confidence (graceful when it doesn't).
ALTER TABLE student_assignments
    ADD COLUMN IF NOT EXISTS criteria_json JSONB,
    ADD COLUMN IF NOT EXISTS ai_confidence INTEGER;
