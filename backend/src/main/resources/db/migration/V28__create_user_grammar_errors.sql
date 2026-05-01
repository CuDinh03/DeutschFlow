CREATE TABLE user_grammar_errors  (
  id          BIGSERIAL,
  user_id     BIGINT       NOT NULL,
  session_id  BIGINT,
  message_id  BIGINT,
  grammar_point  VARCHAR(255) NOT NULL,
  original_text  TEXT,
  correction_text TEXT,
  severity    VARCHAR(16)  NOT NULL DEFAULT 'medium',
  cefr_level  VARCHAR(8),
  created_at  TIMESTAMP(6)  NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_uge_user    FOREIGN KEY (user_id)    REFERENCES users(id)              ON DELETE CASCADE,
  CONSTRAINT fk_uge_session FOREIGN KEY (session_id) REFERENCES ai_speaking_sessions(id) ON DELETE SET NULL,
  CONSTRAINT fk_uge_message FOREIGN KEY (message_id) REFERENCES ai_speaking_messages(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_uge_user_created ON user_grammar_errors (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uge_user_point ON user_grammar_errors (user_id, grammar_point);
