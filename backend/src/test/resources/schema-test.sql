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
  color VARCHAR(7) NULL,
  is_topic_taxonomy BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS word_tags (
  word_id BIGINT NOT NULL,
  tag_id BIGINT NOT NULL,
  PRIMARY KEY (word_id, tag_id)
);

-- Optional noun row per word (WordQueryService JOIN for gender filter)
CREATE TABLE IF NOT EXISTS nouns (
  id BIGINT NOT NULL PRIMARY KEY,
  gender VARCHAR(8) NULL,
  plural_form VARCHAR(200) NULL,
  genitive_form VARCHAR(200) NULL,
  noun_type VARCHAR(32) NULL,
  FOREIGN KEY (id) REFERENCES words(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS word_translations (
  word_id BIGINT NOT NULL,
  locale VARCHAR(8) NOT NULL,
  meaning TEXT NULL,
  example TEXT NULL,
  PRIMARY KEY (word_id, locale),
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
);

-- WordQueryService.listWords always runs JDBC lookups for verb/adjective details per row
CREATE TABLE IF NOT EXISTS verbs (
  id BIGINT NOT NULL PRIMARY KEY,
  auxiliary_verb VARCHAR(16) NOT NULL DEFAULT 'HABEN',
  partizip2 VARCHAR(100) NOT NULL,
  is_separable BOOLEAN NOT NULL DEFAULT FALSE,
  prefix VARCHAR(20) NULL,
  is_irregular BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (id) REFERENCES words(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS verb_conjugations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  verb_id BIGINT NOT NULL,
  tense VARCHAR(32) NOT NULL,
  pronoun VARCHAR(32) NOT NULL,
  form VARCHAR(100) NOT NULL,
  FOREIGN KEY (verb_id) REFERENCES verbs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS adjectives (
  id BIGINT NOT NULL PRIMARY KEY,
  comparative VARCHAR(100) NULL,
  superlative VARCHAR(100) NULL,
  is_irregular BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (id) REFERENCES words(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS noun_declension_forms (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  noun_id BIGINT NOT NULL,
  kasus VARCHAR(32) NOT NULL,
  numerus VARCHAR(32) NOT NULL,
  form VARCHAR(100) NOT NULL,
  FOREIGN KEY (noun_id) REFERENCES nouns(id) ON DELETE CASCADE
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

-- Subscription plans + subscriptions (quota)
CREATE TABLE IF NOT EXISTS subscription_plans (
  code VARCHAR(32) NOT NULL PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  monthly_token_limit BIGINT NOT NULL,
  daily_token_grant BIGINT NOT NULL DEFAULT 0,
  wallet_cap_days INT NOT NULL DEFAULT 0,
  features_json JSON NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_ai_token_wallets (
  user_id BIGINT NOT NULL PRIMARY KEY,
  balance BIGINT NOT NULL DEFAULT 0,
  last_accrual_local_date DATE NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  plan_code VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL,
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NULL,
  monthly_token_limit_override BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_code) REFERENCES subscription_plans(code)
);

CREATE TABLE IF NOT EXISTS ai_token_usage_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  provider VARCHAR(16) NOT NULL,
  model VARCHAR(128) NULL,
  prompt_tokens INT NOT NULL,
  completion_tokens INT NOT NULL,
  total_tokens INT NOT NULL,
  feature VARCHAR(32) NOT NULL,
  request_id VARCHAR(64) NULL,
  session_id BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

MERGE INTO subscription_plans (code, name, monthly_token_limit, daily_token_grant, wallet_cap_days, features_json, is_active)
KEY(code)
VALUES ('FREE', 'Free', 50000, 50000, 0, NULL, TRUE);

MERGE INTO subscription_plans (code, name, monthly_token_limit, daily_token_grant, wallet_cap_days, features_json, is_active)
KEY(code)
VALUES ('PRO', 'Pro', 400000, 400000, 30, NULL, TRUE);

MERGE INTO subscription_plans (code, name, monthly_token_limit, daily_token_grant, wallet_cap_days, features_json, is_active)
KEY(code)
VALUES ('ULTRA', 'Ultra', 850000, 850000, 30, NULL, TRUE);

MERGE INTO subscription_plans (code, name, monthly_token_limit, daily_token_grant, wallet_cap_days, features_json, is_active)
KEY(code)
VALUES ('INTERNAL', 'Internal', 999999999, 0, 0, NULL, TRUE);

MERGE INTO subscription_plans (code, name, monthly_token_limit, daily_token_grant, wallet_cap_days, features_json, is_active)
KEY(code)
VALUES ('DEFAULT', 'Default', 0, 0, 0, NULL, TRUE);

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

CREATE TABLE IF NOT EXISTS speaking_user_state (
  user_id BIGINT PRIMARY KEY,
  rolling_accuracy_pct DECIMAL(5, 2) NOT NULL DEFAULT 100.00,
  rolling_window INT NOT NULL DEFAULT 8,
  difficulty_knob SMALLINT NOT NULL DEFAULT 0,
  current_focus_codes_json TEXT NULL,
  cooldown_codes_json TEXT NULL,
  focus_success_streak_json TEXT NULL,
  last_topic VARCHAR(200) NULL,
  last_topic_at TIMESTAMP NULL,
  last_evaluated_turn_id BIGINT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS speaking_turn_evaluation (
  turn_id BIGINT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  session_id BIGINT NOT NULL,
  error_count INT NOT NULL DEFAULT 0,
  major_plus_count INT NOT NULL DEFAULT 0,
  focus_hit BOOLEAN NOT NULL DEFAULT FALSE,
  difficulty_at_turn SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- AI Speaking Practice tables
CREATE TABLE IF NOT EXISTS ai_speaking_sessions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  topic VARCHAR(200) NULL,
  cefr_level VARCHAR(8) NULL,
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

-- Coaching companion (mirrors Flyway V43; H2-compatible types)
CREATE TABLE IF NOT EXISTS learner_period_check_ins (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  period_type VARCHAR(16) NOT NULL,
  period_start DATE NOT NULL,
  period_end_exclusive DATE NOT NULL,
  mood_score TINYINT NULL,
  reflection_text CLOB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, period_type, period_start)
);

CREATE TABLE IF NOT EXISTS learner_progress_reports (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  period_type VARCHAR(16) NOT NULL,
  period_start DATE NOT NULL,
  period_end_exclusive DATE NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  learner_check_in_id BIGINT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
  metrics_json JSON NOT NULL,
  highlights_json JSON NULL,
  focus_errors_json JSON NULL,
  guidance_markdown CLOB NULL,
  next_steps_json JSON NULL,
  model_name VARCHAR(128) NULL,
  prompt_version VARCHAR(32) NULL,
  generation_error VARCHAR(768) NULL,
  generated_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (learner_check_in_id) REFERENCES learner_period_check_ins(id) ON DELETE SET NULL,
  UNIQUE (user_id, period_type, period_start)
);

CREATE TABLE IF NOT EXISTS learner_report_feedback (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  report_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  rating TINYINT NOT NULL,
  comment_text CLOB NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES learner_progress_reports(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (report_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_coach_preferences (
  user_id BIGINT NOT NULL PRIMARY KEY,
  exercise_reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  coach_encouragement_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  weekly_report_notice_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  weekly_resource_digest_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  quiet_hours_start_local TIME NULL,
  quiet_hours_end_local TIME NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS coach_in_app_notifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  kind VARCHAR(32) NOT NULL,
  title VARCHAR(240) NOT NULL,
  body CLOB NOT NULL,
  action_path VARCHAR(512) NULL,
  dedupe_key VARCHAR(128) NULL,
  read_at TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, dedupe_key)
);

CREATE TABLE IF NOT EXISTS coach_scheduled_deliveries (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  delivery_kind VARCHAR(32) NOT NULL,
  fire_at TIMESTAMP NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  payload_json JSON NULL,
  last_error VARCHAR(512) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS curated_resource_channels (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  display_name VARCHAR(200) NOT NULL,
  description_text CLOB NULL,
  homepage_url VARCHAR(1024) NOT NULL,
  audience VARCHAR(24) NOT NULL DEFAULT 'GENERAL',
  language_tags_json JSON NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS curated_resource_entries (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  channel_id BIGINT NOT NULL,
  digest_week_start DATE NOT NULL,
  headline VARCHAR(360) NOT NULL,
  summary_text CLOB NOT NULL,
  canonical_url VARCHAR(512) NOT NULL,
  source_published_date DATE NULL,
  attribution_note VARCHAR(256) NULL,
  created_by VARCHAR(24) NOT NULL DEFAULT 'ADMIN',
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (channel_id) REFERENCES curated_resource_channels(id) ON DELETE CASCADE,
  UNIQUE (digest_week_start, canonical_url)
);

CREATE TABLE IF NOT EXISTS weekly_speaking_prompts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  week_start_date DATE NOT NULL,
  cefr_band VARCHAR(8) NOT NULL,
  title VARCHAR(280) NOT NULL,
  prompt_de CLOB NOT NULL,
  mandatory_points_json JSON NOT NULL,
  optional_points_json JSON NULL,
  prompt_version VARCHAR(32) NOT NULL DEFAULT 'v1',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (week_start_date, cefr_band)
);

CREATE TABLE IF NOT EXISTS weekly_speaking_submissions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  prompt_id BIGINT NOT NULL,
  transcript_text CLOB NOT NULL,
  audio_duration_sec DECIMAL(8,2) NULL,
  rubric_payload_json JSON NULL,
  grammar_errors_extracted_json JSON NULL,
  model_used VARCHAR(128) NULL,
  rubric_prompt_version VARCHAR(32) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (prompt_id) REFERENCES weekly_speaking_prompts(id) ON DELETE CASCADE,
  UNIQUE (user_id, prompt_id)
);
