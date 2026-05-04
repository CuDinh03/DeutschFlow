-- Speaking tutor persona (Module 10): DEFAULT | LUKAS | EMMA | KLAUS
ALTER TABLE ai_speaking_sessions
    ADD COLUMN persona VARCHAR(32) NOT NULL DEFAULT 'DEFAULT';

COMMENT ON COLUMN ai_speaking_sessions.persona IS 'SpeakingPersona enum name; DEFAULT = legacy neutral tutor';
