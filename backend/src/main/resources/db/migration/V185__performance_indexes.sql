-- V185: Additional performance indexes
-- Targets: vocabulary upsert check (case-insensitive), grammar error aggregation by point+date

-- Speed up case-insensitive vocabulary upsert check
-- Complements the existing idx_words_base_form (plain BTree); this expression index
-- covers LOWER(base_form) lookups used during incremental import deduplication.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_words_lower_base_form
    ON words (LOWER(base_form));

-- Speed up grammar error aggregation by point + date
-- The existing idx_uge_user_point covers (user_id, grammar_point) but not created_at,
-- so time-windowed weak-point queries must filter post-join. This composite index
-- avoids that extra sort/filter step.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_grammar_errors_user_point_created
    ON user_grammar_errors (user_id, grammar_point, created_at);
