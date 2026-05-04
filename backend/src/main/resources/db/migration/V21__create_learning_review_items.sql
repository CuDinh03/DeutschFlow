CREATE TABLE IF NOT EXISTS learning_review_items  (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  item_type VARCHAR(64) NOT NULL,
  item_ref VARCHAR(128) NOT NULL,
  prompt TEXT NOT NULL,
  repetitions INT NOT NULL DEFAULT 0,
  interval_days INT NOT NULL DEFAULT 0,
  ease_factor DECIMAL(4,2) NOT NULL DEFAULT 2.50,
  due_at TIMESTAMP NOT NULL,
  last_reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_review_item_user_type_ref UNIQUE (user_id, item_type, item_ref),
  CONSTRAINT fk_review_item_user FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_review_item_user_due ON learning_review_items (user_id, due_at);
