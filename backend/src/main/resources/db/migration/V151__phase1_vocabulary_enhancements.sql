-- Phase 1: Foundation - Add vocabulary enhancements
-- Adds columns for audio files, pronunciation, grammar context

ALTER TABLE words ADD COLUMN IF NOT EXISTS pronunciation_ipa VARCHAR(100);
ALTER TABLE words ADD COLUMN IF NOT EXISTS example_sentence TEXT;
ALTER TABLE words ADD COLUMN IF NOT EXISTS audio_url VARCHAR(255);
ALTER TABLE words ADD COLUMN IF NOT EXISTS frequency_rank INT DEFAULT 10000;
ALTER TABLE words ADD COLUMN IF NOT EXISTS cefr_level VARCHAR(5) DEFAULT 'A1';

-- Add session mode for greeting practice
ALTER TABLE ai_speaking_sessions ADD COLUMN IF NOT EXISTS session_mode VARCHAR(20) DEFAULT 'COMMUNICATION';
ALTER TABLE ai_speaking_sessions ADD COLUMN IF NOT EXISTS difficulty_level INT DEFAULT 1;
ALTER TABLE ai_speaking_sessions ADD COLUMN IF NOT EXISTS user_confidence_score INT DEFAULT 0;

-- Add columns to track learning progress
ALTER TABLE user_learning_profiles ADD COLUMN IF NOT EXISTS daily_streak INT DEFAULT 0;
ALTER TABLE user_learning_profiles ADD COLUMN IF NOT EXISTS words_learned_count INT DEFAULT 0;
ALTER TABLE user_learning_profiles ADD COLUMN IF NOT EXISTS last_learning_date DATE;

-- Create index for CEFR level lookup
CREATE INDEX IF NOT EXISTS idx_words_cefr_level ON words(cefr_level);
CREATE INDEX IF NOT EXISTS idx_words_frequency ON words(frequency_rank);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_mode ON ai_speaking_sessions(session_mode);
