CREATE TABLE IF NOT EXISTS vocabulary_import_state (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  source_name VARCHAR(64) NOT NULL,
  state_key VARCHAR(80) NOT NULL,
  state_value TEXT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_vocabulary_import_state_source_key (source_name, state_key)
);

CREATE TABLE IF NOT EXISTS vocabulary_import_errors (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  source_name VARCHAR(64) NOT NULL,
  source_url VARCHAR(600) NULL,
  base_form VARCHAR(120) NULL,
  error_type VARCHAR(80) NOT NULL,
  error_message VARCHAR(500) NULL,
  payload_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vocabulary_import_errors_source_created (source_name, created_at)
);
