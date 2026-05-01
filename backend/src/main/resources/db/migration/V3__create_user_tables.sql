-- ============================================================
-- V3: MODULE USER
-- ============================================================

CREATE TABLE users  (
    id            BIGSERIAL PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name  VARCHAR(100) NOT NULL,
    role          VARCHAR(64) NOT NULL DEFAULT 'STUDENT',
    locale        VARCHAR(64) NOT NULL DEFAULT 'vi',
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE refresh_tokens  (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT       NOT NULL,
    token      VARCHAR(512) NOT NULL UNIQUE,
    expires_at TIMESTAMP(6)  NOT NULL,
    revoked    BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


CREATE TABLE user_word_progress  (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT       NOT NULL,
    word_id        BIGINT       NOT NULL,
    ease_factor    DECIMAL(4,2) NOT NULL DEFAULT 2.50,
    interval_days  INT          NOT NULL DEFAULT 1,
    repetition     INT          NOT NULL DEFAULT 0,
    next_review_at TIMESTAMP(6)  NOT NULL,
    last_quality   SMALLINT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
    CONSTRAINT uq_user_word UNIQUE (user_id, word_id)
);
CREATE INDEX IF NOT EXISTS idx_srs_review ON user_word_progress (user_id, next_review_at);
