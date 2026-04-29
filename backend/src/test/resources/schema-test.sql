CREATE TABLE IF NOT EXISTS api_telemetry_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  event_name VARCHAR(80) NOT NULL,
  event_time TIMESTAMP NOT NULL,
  user_id BIGINT NULL,
  session_id VARCHAR(128) NULL,
  role VARCHAR(50) NULL,
  request_id VARCHAR(64) NOT NULL,
  method VARCHAR(10) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  status_code INT NOT NULL,
  latency_ms BIGINT NOT NULL,
  is_error BOOLEAN NOT NULL DEFAULT FALSE
);

-- Minimal vocabulary schema for JDBC-based import tests (H2 MODE=MySQL)
CREATE TABLE IF NOT EXISTS words (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  dtype VARCHAR(20) NOT NULL,
  base_form VARCHAR(100) NOT NULL,
  phonetic VARCHAR(120) NULL,
  usage_note TEXT NULL,
  cefr_level VARCHAR(10) NOT NULL DEFAULT 'A1',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tags (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  color VARCHAR(7) NULL
);

CREATE TABLE IF NOT EXISTS word_tags (
  word_id BIGINT NOT NULL,
  tag_id BIGINT NOT NULL,
  PRIMARY KEY (word_id, tag_id)
);

CREATE TABLE IF NOT EXISTS vocabulary_import_state (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  source_name VARCHAR(64) NOT NULL,
  state_key VARCHAR(80) NOT NULL,
  state_value TEXT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_name, state_key)
);

-- Users table for authentication tests
CREATE TABLE IF NOT EXISTS users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  locale VARCHAR(10) NOT NULL DEFAULT 'vi',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- User learning profiles for AI speaking personalization
CREATE TABLE IF NOT EXISTS user_learning_profiles (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE,
  goal_type VARCHAR(50) NOT NULL,
  target_level VARCHAR(10) NOT NULL,
  current_level VARCHAR(10) NOT NULL DEFAULT 'A0',
  age_range VARCHAR(50) NULL,
  interests_json TEXT NULL,
  industry VARCHAR(100) NULL,
  work_use_cases_json TEXT NULL,
  exam_type VARCHAR(50) NULL,
  sessions_per_week INT NOT NULL,
  minutes_per_session INT NOT NULL,
  learning_speed VARCHAR(50) NOT NULL DEFAULT 'NORMAL',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- AI Speaking Practice tables
CREATE TABLE IF NOT EXISTS ai_speaking_sessions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  topic VARCHAR(200) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  message_count INT NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_speaking_messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT NOT NULL,
  role VARCHAR(20) NOT NULL,
  user_text TEXT NULL,
  ai_speech_de TEXT NULL,
  correction TEXT NULL,
  explanation_vi TEXT NULL,
  grammar_point VARCHAR(200) NULL,
  new_word VARCHAR(200) NULL,
  user_interest_detected VARCHAR(200) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES ai_speaking_sessions(id) ON DELETE CASCADE
);
