-- V27: Create AI Speaking Practice tables
-- Bảng phiên hội thoại luyện nói
CREATE TABLE ai_speaking_sessions  (
    id                BIGSERIAL PRIMARY KEY,
    user_id           BIGINT NOT NULL,
    topic             VARCHAR(200),
    status            VARCHAR(64) NOT NULL DEFAULT 'ACTIVE',
    started_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at          TIMESTAMP,
    message_count     INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_ai_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ai_session_user_status ON ai_speaking_sessions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_session_last_activity ON ai_speaking_sessions (last_activity_at);


-- Bảng tin nhắn trong phiên hội thoại
CREATE TABLE ai_speaking_messages  (
    id                      BIGSERIAL PRIMARY KEY,
    session_id              BIGINT NOT NULL,
    role                    VARCHAR(64) NOT NULL,
    user_text               TEXT,
    ai_speech_de            TEXT,
    correction              TEXT,
    explanation_vi          TEXT,
    grammar_point           VARCHAR(200),
    new_word                VARCHAR(200),
    user_interest_detected  VARCHAR(200),
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ai_message_session FOREIGN KEY (session_id) REFERENCES ai_speaking_sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ai_message_session_created ON ai_speaking_messages (session_id, created_at);
