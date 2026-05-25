-- =============================================================================
-- V138: Add FSRS-4.5 fields to vocab_review_schedule (Migrate-on-Read strategy)
--
-- Strategy: Keep SM-2 fields intact. Add FSRS fields alongside them.
-- When a user reviews an SM-2 card, SrsService will compute FSRS from scratch
-- and set algorithm_version = 'FSRS'. New cards start as FSRS directly.
--
-- FSRS-4.5 parameters:
--   stability      (S) — days until retrievability drops to 0.9
--   difficulty     (D) — card difficulty 1-10, initialized at 5.0 (medium)
--   retrievability (R) — probability of recall at time t (0-1)
--   fsrs_state     — New(0), Learning(1), Review(2), Relearning(3)
--
-- SM-2 fields (ease_factor, interval_days, repetitions, last_quality) remain
-- untouched so rollback to SM-2 is always possible without data loss.
-- =============================================================================

ALTER TABLE vocab_review_schedule
    -- Algorithm flag: which algorithm manages this card
    ADD COLUMN IF NOT EXISTS algorithm_version VARCHAR(10) NOT NULL DEFAULT 'SM2',

    -- FSRS core state machine
    ADD COLUMN IF NOT EXISTS fsrs_state        SMALLINT    NOT NULL DEFAULT 0,
    -- 0=New, 1=Learning, 2=Review, 3=Relearning

    -- FSRS scheduling parameters
    ADD COLUMN IF NOT EXISTS stability         NUMERIC(10, 4) NULL,
    -- S: days for retrievability to reach 0.9 (null = not yet computed)

    ADD COLUMN IF NOT EXISTS difficulty        NUMERIC(4, 2)  NULL,
    -- D: card difficulty 1.0-10.0 (null = not yet computed)

    ADD COLUMN IF NOT EXISTS retrievability    NUMERIC(6, 4)  NULL;
    -- R: probability of recall (0.0-1.0) at last review time (null = not reviewed)

-- Index for fast due-card queries scoped by algorithm
CREATE INDEX IF NOT EXISTS idx_srs_algo_version
    ON vocab_review_schedule (user_id, algorithm_version, next_review_at);

-- Comment to self-document the migration intent
COMMENT ON COLUMN vocab_review_schedule.algorithm_version IS
    'SM2 = SuperMemo-2 legacy; FSRS = FSRS-4.5 (set when card first reviewed after upgrade)';
COMMENT ON COLUMN vocab_review_schedule.stability IS
    'FSRS S parameter: days until retrievability = 0.9';
COMMENT ON COLUMN vocab_review_schedule.difficulty IS
    'FSRS D parameter: card difficulty 1.0 (easy) to 10.0 (hard), init=5.0';
COMMENT ON COLUMN vocab_review_schedule.retrievability IS
    'FSRS R parameter: recall probability at last review moment';
