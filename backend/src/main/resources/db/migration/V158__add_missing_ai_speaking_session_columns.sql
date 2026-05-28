-- Add missing columns to ai_speaking_sessions table for Phase 1 completion

-- Add core interaction columns
ALTER TABLE ai_speaking_sessions ADD COLUMN IF NOT EXISTS ai_prompt TEXT;
ALTER TABLE ai_speaking_sessions ADD COLUMN IF NOT EXISTS ai_response TEXT;
ALTER TABLE ai_speaking_sessions ADD COLUMN IF NOT EXISTS user_input TEXT;
ALTER TABLE ai_speaking_sessions ADD COLUMN IF NOT EXISTS feedback TEXT;

-- Add scoring and feedback columns
ALTER TABLE ai_speaking_sessions ADD COLUMN IF NOT EXISTS ai_score INT;
ALTER TABLE ai_speaking_sessions ADD COLUMN IF NOT EXISTS ai_feedback TEXT;
ALTER TABLE ai_speaking_sessions ADD COLUMN IF NOT EXISTS teacher_score INT;
ALTER TABLE ai_speaking_sessions ADD COLUMN IF NOT EXISTS teacher_feedback TEXT;

-- Add additional context columns
ALTER TABLE ai_speaking_sessions ADD COLUMN IF NOT EXISTS cefr_level VARCHAR(8);
ALTER TABLE ai_speaking_sessions ADD COLUMN IF NOT EXISTS persona VARCHAR(32) DEFAULT 'DEFAULT';
ALTER TABLE ai_speaking_sessions ADD COLUMN IF NOT EXISTS response_schema VARCHAR(8) DEFAULT 'V1';
ALTER TABLE ai_speaking_sessions ADD COLUMN IF NOT EXISTS interview_position VARCHAR(100);
ALTER TABLE ai_speaking_sessions ADD COLUMN IF NOT EXISTS experience_level VARCHAR(20);
ALTER TABLE ai_speaking_sessions ADD COLUMN IF NOT EXISTS interview_report_json TEXT;
ALTER TABLE ai_speaking_sessions ADD COLUMN IF NOT EXISTS interview_state_json TEXT;

-- Add metadata columns
ALTER TABLE ai_speaking_sessions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
ALTER TABLE ai_speaking_sessions ADD COLUMN IF NOT EXISTS session_status VARCHAR(50);
ALTER TABLE ai_speaking_sessions ADD COLUMN IF NOT EXISTS template_id BIGINT;
ALTER TABLE ai_speaking_sessions ADD COLUMN IF NOT EXISTS assignment_id BIGINT;
ALTER TABLE ai_speaking_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE ai_speaking_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
