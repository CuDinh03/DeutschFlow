-- Parallel JSON contracts: V1 (full tutor) vs V2 (compact persona template)
ALTER TABLE ai_speaking_sessions
    ADD COLUMN response_schema VARCHAR(8) NOT NULL DEFAULT 'V1';

COMMENT ON COLUMN ai_speaking_sessions.response_schema IS 'SpeakingResponseSchema: V1 | V2';

ALTER TABLE ai_speaking_messages
    ADD COLUMN assistant_action TEXT;

ALTER TABLE ai_speaking_messages
    ADD COLUMN assistant_feedback TEXT;
