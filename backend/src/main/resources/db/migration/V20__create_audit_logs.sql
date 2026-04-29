CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  event_name VARCHAR(100) NOT NULL,
  actor_user_id BIGINT NULL,
  actor_email VARCHAR(255) NULL,
  actor_role VARCHAR(50) NULL,
  target_type VARCHAR(100) NOT NULL,
  target_id VARCHAR(120) NULL,
  metadata_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_logs_created_at (created_at),
  INDEX idx_audit_logs_event_name (event_name)
);
