CREATE TABLE IF NOT EXISTS api_telemetry_events  (
  id BIGSERIAL PRIMARY KEY,
  event_name VARCHAR(80) NOT NULL,
  event_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id BIGINT NULL,
  session_id VARCHAR(128) NULL,
  role VARCHAR(50) NULL,
  request_id VARCHAR(64) NOT NULL,
  method VARCHAR(10) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  status_code INT NOT NULL,
  latency_ms BIGINT NOT NULL,
  is_error BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_api_telemetry_event_time ON api_telemetry_events (event_time);
CREATE INDEX IF NOT EXISTS idx_api_telemetry_endpoint_time ON api_telemetry_events (endpoint, event_time);
CREATE INDEX IF NOT EXISTS idx_api_telemetry_request_id ON api_telemetry_events (request_id);
