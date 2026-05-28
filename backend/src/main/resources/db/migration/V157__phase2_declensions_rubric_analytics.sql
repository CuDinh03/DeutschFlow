-- Phase 2: Word declension tables, interview rubric, and learning analytics

-- ── 1. word_declensions ────────────────────────────────────────────────────
-- Stores the full declension table for each noun (all 4 cases × singular/plural).
-- Only nouns with a known gender can have declensions.
CREATE TABLE IF NOT EXISTS word_declensions (
    id              BIGSERIAL PRIMARY KEY,
    word_id         BIGINT       NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    plural_form     VARCHAR(100),                   -- base plural form without article, e.g. "Bücher"
    nom_singular    VARCHAR(120),                   -- "das Buch"
    acc_singular    VARCHAR(120),                   -- "das Buch"
    dat_singular    VARCHAR(120),                   -- "dem Buch"
    gen_singular    VARCHAR(120),                   -- "des Buches"
    nom_plural      VARCHAR(120),                   -- "die Bücher"
    acc_plural      VARCHAR(120),                   -- "die Bücher"
    dat_plural      VARCHAR(120),                   -- "den Büchern"
    gen_plural      VARCHAR(120),                   -- "der Bücher"
    created_at      TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_word_declension UNIQUE (word_id)
);

CREATE INDEX IF NOT EXISTS idx_word_declensions_word ON word_declensions (word_id);

-- ── 2. interview_rubric ────────────────────────────────────────────────────
-- Scoring criteria per category and difficulty level.
-- Final score = Σ(score_level × weight) across categories.
CREATE TABLE IF NOT EXISTS interview_rubric (
    id              BIGSERIAL PRIMARY KEY,
    category        VARCHAR(30)  NOT NULL,  -- FLUENCY | ACCURACY | COMPREHENSION | PRONUNCIATION
    difficulty_level INT         NOT NULL,  -- 1-5
    score_level     INT          NOT NULL,  -- 1-10
    criteria        TEXT         NOT NULL,  -- description of what this score means
    weight          DECIMAL(4,2) NOT NULL,  -- 0.25, 0.35, etc.
    created_at      TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_rubric_cat_diff_score UNIQUE (category, difficulty_level, score_level)
);

-- Seed rubric weights (same for all difficulty levels; criteria vary)
-- Weights: FLUENCY=0.25, ACCURACY=0.35, COMPREHENSION=0.25, PRONUNCIATION=0.15
INSERT INTO interview_rubric (category, difficulty_level, score_level, criteria, weight) VALUES
-- FLUENCY (smooth, natural pacing)
('FLUENCY', 1, 1,  'Very long pauses; speech is almost entirely halting', 0.25),
('FLUENCY', 1, 5,  'Some hesitation but able to continue; reasonable pace', 0.25),
('FLUENCY', 1, 10, 'Smooth, natural pace with minimal pauses', 0.25),
('FLUENCY', 3, 1,  'Frequent halting; cannot sustain multi-sentence response', 0.25),
('FLUENCY', 3, 5,  'Occasional pauses; ideas expressed with effort', 0.25),
('FLUENCY', 3, 10, 'Near-native fluency; very natural delivery', 0.25),

-- ACCURACY (grammar, tense, word choice)
('ACCURACY', 1, 1,  'Multiple critical grammar errors per utterance', 0.35),
('ACCURACY', 1, 5,  'Some grammar errors but meaning is clear', 0.35),
('ACCURACY', 1, 10, 'No significant grammar errors; correct article/tense use', 0.35),
('ACCURACY', 3, 1,  'Frequent errors in article, tense, and agreement', 0.35),
('ACCURACY', 3, 5,  'Occasional errors; mostly correct structure', 0.35),
('ACCURACY', 3, 10, 'Highly accurate; rare minor errors only', 0.35),

-- COMPREHENSION (understood prompt and responded appropriately)
('COMPREHENSION', 1, 1,  'Did not understand the question; off-topic response', 0.25),
('COMPREHENSION', 1, 5,  'Partially understood; response mostly relevant', 0.25),
('COMPREHENSION', 1, 10, 'Fully understood; complete and relevant response', 0.25),
('COMPREHENSION', 3, 1,  'Misunderstood complex question', 0.25),
('COMPREHENSION', 3, 5,  'Understood main point; missed nuances', 0.25),
('COMPREHENSION', 3, 10, 'Full comprehension including implied meaning', 0.25),

-- PRONUNCIATION (clear articulation)
('PRONUNCIATION', 1, 1,  'Very difficult to understand; heavy L1 interference', 0.15),
('PRONUNCIATION', 1, 5,  'Understandable; some non-native sounds', 0.15),
('PRONUNCIATION', 1, 10, 'Clear, accurate German pronunciation', 0.15),
('PRONUNCIATION', 3, 1,  'Many pronunciation errors impede understanding', 0.15),
('PRONUNCIATION', 3, 5,  'Mostly clear; a few persistent errors', 0.15),
('PRONUNCIATION', 3, 10, 'Near-native pronunciation; excellent clarity', 0.15);

-- ── 3. learning_analytics ──────────────────────────────────────────────────
-- One row per (user, date) — aggregated daily learning statistics.
CREATE TABLE IF NOT EXISTS learning_analytics (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    analytics_date      DATE         NOT NULL,
    words_learned       INT          NOT NULL DEFAULT 0,   -- new words scheduled that day
    words_reviewed      INT          NOT NULL DEFAULT 0,   -- SRS reviews completed
    speaking_minutes    INT          NOT NULL DEFAULT 0,   -- total AI speaking time (minutes)
    sessions_completed  INT          NOT NULL DEFAULT 0,   -- AI speaking sessions finished
    avg_accuracy        DECIMAL(5,2) NOT NULL DEFAULT 0,   -- average confidence score (1-5 scaled to 0-100)
    avg_confidence      DECIMAL(5,2) NOT NULL DEFAULT 0,   -- self-reported confidence average
    errors_by_type      JSONB        NOT NULL DEFAULT '{}',-- {"TENSE":3,"ARTICLE":2,"PREPOSITION":1}
    focus_areas         JSONB        NOT NULL DEFAULT '[]',-- ["ARTICLE","TENSE"] detected weaknesses
    created_at          TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_analytics_user_date UNIQUE (user_id, analytics_date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_user_date ON learning_analytics (user_id, analytics_date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON learning_analytics (analytics_date DESC);
