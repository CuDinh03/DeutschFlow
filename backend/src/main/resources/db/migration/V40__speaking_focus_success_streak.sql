-- Track per-error-code success streaks to enable cooldown correct repairs
ALTER TABLE speaking_user_state
    ADD COLUMN focus_success_streak_json JSONB NULL;
