-- B1 readiness and assessment state per learner
CREATE TABLE b1_assessment_states (
    id                         BIGSERIAL PRIMARY KEY,
    user_id                    BIGINT NOT NULL UNIQUE REFERENCES users(id),
    vocabulary_check_passed    BOOLEAN NOT NULL DEFAULT FALSE,
    speaking_check_passed      BOOLEAN NOT NULL DEFAULT FALSE,
    grammar_check_passed       BOOLEAN NOT NULL DEFAULT FALSE,
    confidence_check_passed    BOOLEAN NOT NULL DEFAULT FALSE,
    mock_exam_passed           BOOLEAN NOT NULL DEFAULT FALSE,
    readiness_score            INT NOT NULL DEFAULT 0,  -- 0-100 composite
    last_assessment_at         TIMESTAMP,
    graduation_confirmed_at    TIMESTAMP,
    created_at                 TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at                 TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_b1_assessment_states_user_id ON b1_assessment_states(user_id);
