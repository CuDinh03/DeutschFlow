-- Learning mode for AI speaking: free conversation vs. mock interview (prompt + UI).
ALTER TABLE ai_speaking_sessions
    ADD COLUMN session_mode VARCHAR(20) NOT NULL DEFAULT 'COMMUNICATION';
