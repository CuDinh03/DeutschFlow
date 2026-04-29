CREATE TABLE IF NOT EXISTS learning_review_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  item_type ENUM('WORD','GRAMMAR') NOT NULL,
  item_ref VARCHAR(128) NOT NULL,
  prompt TEXT NOT NULL,
  repetitions INT NOT NULL DEFAULT 0,
  interval_days INT NOT NULL DEFAULT 0,
  ease_factor DECIMAL(4,2) NOT NULL DEFAULT 2.50,
  due_at DATETIME NOT NULL,
  last_reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_review_item_user_type_ref (user_id, item_type, item_ref),
  INDEX idx_review_item_user_due (user_id, due_at),
  CONSTRAINT fk_review_item_user FOREIGN KEY (user_id) REFERENCES users(id)
);
