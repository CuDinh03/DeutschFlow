-- V121: Enhanced Exam Evaluation Schema
-- Adds detailed scoring, weak areas detection, and AI feedback support

-- Extend mock_exam_attempts table with detailed evaluation fields
ALTER TABLE mock_exam_attempts
ADD COLUMN IF NOT EXISTS detailed_scores_json JSONB COMMENT 'Per-section and per-teil scores breakdown',
ADD COLUMN IF NOT EXISTS weak_areas JSONB COMMENT 'Array of topics where user scored <60%',
ADD COLUMN IF NOT EXISTS time_spent_json JSONB COMMENT 'Time spent per section (seconds)',
ADD COLUMN IF NOT EXISTS answers_submitted_json JSONB COMMENT 'User answers for review and analytics',
ADD COLUMN IF NOT EXISTS evaluation_notes TEXT COMMENT 'Human evaluator feedback for speaking/writing',
ADD COLUMN IF NOT EXISTS ai_feedback_json JSONB COMMENT 'Structured AI feedback with rubric scores';

-- Create table to track question difficulty and metadata
CREATE TABLE IF NOT EXISTS mock_exam_question_metadata (
  id BIGSERIAL PRIMARY KEY,
  exam_id BIGINT NOT NULL REFERENCES mock_exams(id) ON DELETE CASCADE,
  question_id VARCHAR(50) NOT NULL,
  section VARCHAR(20) NOT NULL, -- LESEN, HOEREN, SCHREIBEN, SPRECHEN
  teil INT NOT NULL,
  difficulty_level VARCHAR(20) DEFAULT 'MEDIUM', -- EASY, MEDIUM, HARD
  topic_tags JSONB, -- Array of grammar/vocab topics
  explanation_vi TEXT, -- Vietnamese explanation
  explanation_de TEXT, -- German explanation
  sample_answer_vi TEXT, -- Sample answer Vietnamese
  sample_answer_de TEXT, -- Sample answer German
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exam_id, question_id)
);

-- Create analytics summary table for faster dashboard queries
CREATE TABLE IF NOT EXISTS mock_exam_analytics (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  exam_id BIGINT NOT NULL,
  attempt_id BIGINT NOT NULL REFERENCES mock_exam_attempts(id) ON DELETE CASCADE,
  section VARCHAR(20) NOT NULL,
  section_score INT NOT NULL,
  section_max INT NOT NULL DEFAULT 25,
  section_percentage INT NOT NULL,
  time_spent_seconds INT,
  attempted_questions INT,
  correct_questions INT,
  weak_topics JSONB, -- Topics where user struggled
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(attempt_id, section)
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_meqm_exam_section ON mock_exam_question_metadata(exam_id, section);
CREATE INDEX IF NOT EXISTS idx_mea_analytics ON mock_exam_analytics(user_id, attempt_id);
CREATE INDEX IF NOT EXISTS idx_mea_section_score ON mock_exam_analytics(section, section_percentage);

-- Sample detailed_scores structure (JSON):
-- {
--   "LESEN": {
--     "total": 23,
--     "max": 25,
--     "percentage": 92,
--     "teile": {
--       "1": {"score": 5, "max": 5},
--       "2": {"score": 8, "max": 10},
--       "3": {"score": 10, "max": 10}
--     }
--   },
--   "HOEREN": {...},
--   "SCHREIBEN": {...},
--   "SPRECHEN": {...}
-- }

-- Sample ai_feedback_json structure (JSON):
-- {
--   "section": "SCHREIBEN",
--   "teil": 2,
--   "rubric_scores": {
--     "aufgabenerfüllung": 4,
--     "kohärenz": 3,
--     "wortschatz": 3,
--     "strukturen": 3
--   },
--   "total_score": 13,
--   "max_score": 15,
--   "feedback_vi": "Bạn đã trả lời được 3 yêu cầu...",
--   "feedback_de": "Sie haben alle 3 Punkte beantwortet...",
--   "strengths": ["Phản hồi đầy đủ", "Thứ tự hợp lý"],
--   "improvements": ["Cần sử dụng từ vựng phong phú hơn", "Một số lỗi ngữ pháp nhỏ"]
-- }
