-- Value-first onboarding redesign (2026-06-07).
-- Capture the learner's underlying motivation ("why are you learning German?") — a richer
-- signal than goal_type, which the client derives (EXAM → CERT, else WORK) — and the daily
-- study goal in minutes (the Duolingo-style streak anchor).
-- Both nullable + additive: older profiles keep NULL and consumers fall back.
ALTER TABLE user_learning_profiles
    ADD COLUMN IF NOT EXISTS motivation         VARCHAR(20),
    ADD COLUMN IF NOT EXISTS daily_goal_minutes INT;
