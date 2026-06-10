-- Whisper STT spend tracking.
-- Groq bills per audio-second (~$0.006/min for whisper-large-v3), not per token,
-- so the token ledger (ai_token_usage_events) is blind to STT costs.
-- This table captures each transcription call so admins see true AI COGS.
CREATE TABLE stt_usage_events (
    id                   BIGSERIAL        PRIMARY KEY,
    user_id              BIGINT           REFERENCES users(id) ON DELETE SET NULL,
    feature              VARCHAR(100)     NOT NULL DEFAULT 'STT_UNKNOWN',
    model                VARCHAR(100)     NOT NULL DEFAULT 'whisper-large-v3',
    audio_duration_secs  DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stt_usage_created_at ON stt_usage_events(created_at);
CREATE INDEX idx_stt_usage_feature    ON stt_usage_events(feature, created_at);
CREATE INDEX idx_stt_usage_user_id    ON stt_usage_events(user_id, created_at) WHERE user_id IS NOT NULL;
