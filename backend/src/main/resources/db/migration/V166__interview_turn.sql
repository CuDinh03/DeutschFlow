-- Structured per-turn storage for interview sessions
CREATE TABLE IF NOT EXISTS interview_turn (
    id                   BIGSERIAL    PRIMARY KEY,
    session_id           BIGINT       NOT NULL REFERENCES ai_speaking_sessions(id) ON DELETE CASCADE,
    turn_index           INT          NOT NULL,
    phase                VARCHAR(30)  NOT NULL,
    question_id          VARCHAR(100),               -- FK to interview_question.id (nullable for fallback questions)
    question_text        TEXT         NOT NULL,
    user_answer          TEXT,
    ai_follow_up         TEXT,
    answer_analysis_json TEXT,                       -- JSON from InterviewAnswerAnalysis
    score_json           TEXT,                       -- JSON per-criterion scores for this turn
    directive_type       VARCHAR(50),                -- InterviewDirectiveType name
    latency_ms           INT,
    created_at           TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE (session_id, turn_index)
);

CREATE INDEX IF NOT EXISTS idx_it_session ON interview_turn (session_id, turn_index);
