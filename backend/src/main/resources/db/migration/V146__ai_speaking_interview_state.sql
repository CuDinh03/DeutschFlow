-- V146: Persist deterministic interview orchestration state per session
ALTER TABLE ai_speaking_sessions
    ADD COLUMN IF NOT EXISTS interview_state_json TEXT;
