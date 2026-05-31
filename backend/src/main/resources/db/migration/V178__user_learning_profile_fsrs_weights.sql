-- Per-user FSRS-4.5 weights, stored as a JSON array of 20 doubles [w0..w19].
-- NULL means the user has not yet accumulated enough reviews (threshold: 50).
-- The FsrsWeightOptimizerService writes to this column; FsrsService reads it.
ALTER TABLE user_learning_profiles
    ADD COLUMN IF NOT EXISTS fsrs_weights_json  JSONB,
    ADD COLUMN IF NOT EXISTS fsrs_weights_updated_at TIMESTAMP(6);
