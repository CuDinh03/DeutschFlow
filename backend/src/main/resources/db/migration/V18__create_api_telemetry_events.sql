CREATE TABLE IF NOT EXISTS api_telemetry_events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  event_name VARCHAR(80) NOT NULL,
  event_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id BIGINT NULL,
  session_id VARCHAR(128) NULL,
  role VARCHAR(50) NULL,
  request_id VARCHAR(64) NOT NULL,
  method VARCHAR(10) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  status_code INT NOT NULL,
  latency_ms BIGINT NOT NULL,
  is_error TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_api_telemetry_event_time (event_time),
  INDEX idx_api_telemetry_endpoint_time (endpoint, event_time),
  INDEX idx_api_telemetry_request_id (request_id)
);
