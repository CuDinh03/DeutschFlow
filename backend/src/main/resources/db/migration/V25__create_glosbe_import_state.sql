CREATE TABLE IF NOT EXISTS vocabulary_import_state  (
  id BIGSERIAL PRIMARY KEY,
  source_name VARCHAR(64) NOT NULL,
  state_key VARCHAR(80) NOT NULL,
  state_value TEXT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_vocabulary_import_state_source_key UNIQUE (source_name, state_key)
);


CREATE TABLE IF NOT EXISTS vocabulary_import_errors  (
  id BIGSERIAL PRIMARY KEY,
  source_name VARCHAR(64) NOT NULL,
  source_url VARCHAR(600) NULL,
  base_form VARCHAR(120) NULL,
  error_type VARCHAR(80) NOT NULL,
  error_message VARCHAR(500) NULL,
  payload_json JSONB NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_vocabulary_import_errors_source_created ON vocabulary_import_errors (source_name, created_at);
