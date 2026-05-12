-- V125: B2B2C Teacher Homework & SRS Review Tasks

-- (error_review_tasks table is already created in V35)

-- 2. B2B2C Teacher Homework Submissions
-- Stores detailed AI interview submissions when a student does homework assigned by a teacher.
-- Note: A quiz_session is also created for high-level scoring, but this stores the granular AI outputs.
CREATE TABLE teacher_homework_submissions  (
    id BIGSERIAL PRIMARY KEY,
    quiz_session_id BIGINT NOT NULL,
    classroom_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    audio_url VARCHAR(500),
    transcript_de TEXT,
    fluency_score INT NOT NULL DEFAULT 0,
    grammar_score INT NOT NULL DEFAULT 0,
    ai_feedback_json TEXT, -- The full JSON report from AI
    submitted_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_homework_session FOREIGN KEY (quiz_session_id) REFERENCES quiz_sessions (id) ON DELETE CASCADE,
    CONSTRAINT fk_homework_class FOREIGN KEY (classroom_id) REFERENCES classrooms (id) ON DELETE CASCADE,
    CONSTRAINT fk_homework_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_homework_class_student ON teacher_homework_submissions (classroom_id, student_id);

-- 3. Mock Exam / Placement Test Results (Onboarding)
-- Stores the 3-minute placement test results for the user
CREATE TABLE user_placement_tests  (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    audio_url VARCHAR(500),
    transcript_de TEXT,
    estimated_cefr VARCHAR(16),
    radar_chart_data_json TEXT, -- JSON containing scores for vocab, grammar, fluency, etc.
    top_errors_json TEXT, -- JSON containing the top 3 errors detected
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_placement_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
