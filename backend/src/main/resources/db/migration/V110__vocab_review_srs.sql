-- V110: Spaced Repetition System (SRS) — vocab review schedule
-- Thuật toán SM-2 (SuperMemo 2)

CREATE TABLE IF NOT EXISTS vocab_review_schedule (
    id                BIGSERIAL PRIMARY KEY,
    user_id           BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    node_id           BIGINT        REFERENCES skill_tree_nodes(id) ON DELETE SET NULL,
    vocab_id          VARCHAR(80)   NOT NULL,          -- e.g. "sg01_01" hoặc hash
    german            TEXT          NOT NULL,
    meaning           TEXT          NOT NULL,
    example_de        TEXT,
    speak_de          TEXT,

    -- SM-2 fields
    ease_factor       NUMERIC(4,2)  NOT NULL DEFAULT 2.50,
    interval_days     INTEGER       NOT NULL DEFAULT 1,
    repetitions       INTEGER       NOT NULL DEFAULT 0,
    next_review_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    last_review_at    TIMESTAMPTZ,
    last_quality      SMALLINT,                         -- 0-5 SM-2 quality rating

    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, vocab_id)                         -- 1 entry per vocab per user
);

-- Index for efficient "due today" queries
CREATE INDEX IF NOT EXISTS idx_vrs_user_due
    ON vocab_review_schedule (user_id, next_review_at);

COMMENT ON TABLE vocab_review_schedule IS
    'Spaced repetition schedule per user/vocab using SM-2 algorithm';
