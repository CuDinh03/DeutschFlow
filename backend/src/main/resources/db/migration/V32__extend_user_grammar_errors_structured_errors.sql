-- Structured errors + drill repair status (PostgreSQL)
ALTER TABLE user_grammar_errors
  ALTER COLUMN severity TYPE VARCHAR(32) USING severity::varchar,
  ALTER COLUMN severity SET NOT NULL,
  ALTER COLUMN severity SET DEFAULT 'medium';

ALTER TABLE user_grammar_errors
  ADD COLUMN IF NOT EXISTS error_code VARCHAR(80) NULL,
  ADD COLUMN IF NOT EXISTS confidence DECIMAL(4,3) NULL,
  ADD COLUMN IF NOT EXISTS wrong_span VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS corrected_span VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS rule_vi_short VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS example_correct_de VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS repair_status VARCHAR(16) NOT NULL DEFAULT 'OPEN';

CREATE INDEX IF NOT EXISTS idx_uge_user_error_created ON user_grammar_errors (user_id, error_code, created_at DESC);
