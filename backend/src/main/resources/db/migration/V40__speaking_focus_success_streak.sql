-- Track per-error-code success streaks to enable cooldown after repeated correct repairs
ALTER TABLE speaking_user_state
    ADD COLUMN focus_success_streak_json JSON NULL;

