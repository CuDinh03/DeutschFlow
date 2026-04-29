CREATE TABLE IF NOT EXISTS grammar_feedback_events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  week_number INT NOT NULL,
  session_index INT NOT NULL,
  phase VARCHAR(32) NOT NULL,
  total_items INT NOT NULL,
  items_with_feedback INT NOT NULL,
  coverage_percent DECIMAL(5,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_grammar_feedback_created_at (created_at),
  INDEX idx_grammar_feedback_user_created_at (user_id, created_at),
  CONSTRAINT fk_grammar_feedback_user FOREIGN KEY (user_id) REFERENCES users(id)
);
