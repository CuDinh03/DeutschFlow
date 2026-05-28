-- Phase engine: tracks each learner's current phase and progression metrics
CREATE TABLE learner_phase_states (
    id                      BIGSERIAL PRIMARY KEY,
    user_id                 BIGINT NOT NULL UNIQUE REFERENCES users(id),
    current_phase           VARCHAR(20) NOT NULL DEFAULT 'FOUNDATION',
    phase_started_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    foundation_completed_at TIMESTAMP,
    production_completed_at TIMESTAMP,
    fluency_completed_at    TIMESTAMP,
    graduated_at            TIMESTAMP,
    vocabulary_mastered_count INT NOT NULL DEFAULT 0,
    speaking_minutes_total    INT NOT NULL DEFAULT 0,
    grammar_accuracy_percent  INT NOT NULL DEFAULT 0,
    sessions_completed        INT NOT NULL DEFAULT 0,
    created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_learner_phase_states_user_id ON learner_phase_states(user_id);
CREATE INDEX idx_learner_phase_states_phase    ON learner_phase_states(current_phase);
