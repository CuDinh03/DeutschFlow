-- V27: Create AI Speaking Practice tables
-- Bảng phiên hội thoại luyện nói
CREATE TABLE ai_speaking_sessions (
    id                BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id           BIGINT NOT NULL,
    topic             VARCHAR(200),
    status            ENUM('ACTIVE', 'ENDED') NOT NULL DEFAULT 'ACTIVE',
    started_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at          DATETIME,
    message_count     INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_ai_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_ai_session_user_status (user_id, status),
    INDEX idx_ai_session_last_activity (last_activity_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bảng tin nhắn trong phiên hội thoại
CREATE TABLE ai_speaking_messages (
    id                      BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id              BIGINT NOT NULL,
    role                    ENUM('USER', 'ASSISTANT') NOT NULL,
    user_text               TEXT,
    ai_speech_de            TEXT,
    correction              TEXT,
    explanation_vi          TEXT,
    grammar_point           VARCHAR(200),
    new_word                VARCHAR(200),
    user_interest_detected  VARCHAR(200),
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ai_message_session FOREIGN KEY (session_id) REFERENCES ai_speaking_sessions(id) ON DELETE CASCADE,
    INDEX idx_ai_message_session_created (session_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
