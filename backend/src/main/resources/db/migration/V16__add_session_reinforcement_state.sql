-- ============================================================
-- V16: Store reinforcement (mistake-based) required exercises
-- ============================================================

ALTER TABLE learning_session_state
    ADD COLUMN reinforcement_json JSONB NULL;
