-- V191: Add focus_success_streak_json to speaking_user_state
-- This column was present only via JPA ddl-auto (SpeakingUserState entity field added after V110
-- which created the table). Adding here so ddl-auto=validate passes on a fresh DB.
-- Nullable TEXT: no default needed; missing rows are treated as empty streak by the service.
ALTER TABLE speaking_user_state
    ADD COLUMN IF NOT EXISTS focus_success_streak_json JSONB;
