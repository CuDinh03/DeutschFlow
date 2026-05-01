-- Structured errors[] + drill repair status (roadmap Phase 0/1)
ALTER TABLE user_grammar_errors
  MODIFY COLUMN severity VARCHAR(32) NOT NULL DEFAULT 'medium';

ALTER TABLE user_grammar_errors
  ADD COLUMN error_code VARCHAR(80) NULL AFTER grammar_point,
  ADD COLUMN confidence DECIMAL(4,3) NULL AFTER error_code,
  ADD COLUMN wrong_span VARCHAR(500) NULL AFTER confidence,
  ADD COLUMN corrected_span VARCHAR(500) NULL AFTER wrong_span,
  ADD COLUMN rule_vi_short VARCHAR(500) NULL AFTER corrected_span,
  ADD COLUMN example_correct_de VARCHAR(500) NULL AFTER rule_vi_short,
  ADD COLUMN repair_status VARCHAR(16) NOT NULL DEFAULT 'OPEN' AFTER example_correct_de;

CREATE INDEX idx_uge_user_error_created ON user_grammar_errors (user_id, error_code, created_at DESC);
