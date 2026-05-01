CREATE TABLE IF NOT EXISTS grammar_feedback_events  (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  week_number INT NOT NULL,
  session_index INT NOT NULL,
  phase VARCHAR(32) NOT NULL,
  total_items INT NOT NULL,
  items_with_feedback INT NOT NULL,
  coverage_percent DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_grammar_feedback_user FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_grammar_feedback_created_at ON grammar_feedback_events (created_at);
CREATE INDEX IF NOT EXISTS idx_grammar_feedback_user_created_at ON grammar_feedback_events (user_id, created_at);
