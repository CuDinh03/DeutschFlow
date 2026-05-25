-- V60: Add interview-specific fields to ai_speaking_sessions
ALTER TABLE ai_speaking_sessions ADD COLUMN interview_position VARCHAR(100);
ALTER TABLE ai_speaking_sessions ADD COLUMN experience_level VARCHAR(20);
ALTER TABLE ai_speaking_sessions ADD COLUMN interview_report_json TEXT;
