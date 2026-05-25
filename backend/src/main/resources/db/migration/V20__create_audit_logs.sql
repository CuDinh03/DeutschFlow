CREATE TABLE IF NOT EXISTS audit_logs  (
  id BIGSERIAL PRIMARY KEY,
  event_name VARCHAR(100) NOT NULL,
  actor_user_id BIGINT NULL,
  actor_email VARCHAR(255) NULL,
  actor_role VARCHAR(50) NULL,
  target_type VARCHAR(100) NOT NULL,
  target_id VARCHAR(120) NULL,
  metadata_json JSONB NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_name ON audit_logs (event_name);
