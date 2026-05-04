-- ============================================================
-- V53: Training dataset tables for AI model fine-tuning
-- Lưu toàn bộ hội thoại + các lỗi sai của người dùng
-- để làm dataset huấn luyện AI local (deutschflow_model)
-- ============================================================

-- Lưu từng lượt hội thoại đầy đủ (user → assistant) theo format Alpaca
CREATE TABLE IF NOT EXISTS training_conversations (
    id                  BIGSERIAL PRIMARY KEY,
    session_id          BIGINT       NOT NULL REFERENCES ai_speaking_sessions(id) ON DELETE CASCADE,
    user_id             BIGINT       NOT NULL,
    cefr_level          VARCHAR(4)   NOT NULL,
    topic               VARCHAR(255),

    -- Raw turn data
    user_message        TEXT         NOT NULL,
    ai_response_de      TEXT,
    correction          TEXT,
    explanation_vi      TEXT,
    grammar_point       TEXT,

    -- Computed Alpaca-format for fine-tuning (JSONL export ready)
    instruction         TEXT,            -- system prompt thô tại thời điểm hội thoại
    input               TEXT,            -- user message
    output              TEXT,            -- ideal AI response (ai_response_de)

    -- Quality/filtering metadata
    has_errors          BOOLEAN      NOT NULL DEFAULT FALSE,
    error_count         INT          NOT NULL DEFAULT 0,
    quality_score       NUMERIC(5,2),    -- 0..100 (tính từ error_count / fluency / độ dài)
    include_in_dataset  BOOLEAN      NOT NULL DEFAULT TRUE,  -- admin có thể exclude

    -- Traceability
    ai_message_id       BIGINT,
    ai_provider         VARCHAR(32)  DEFAULT 'LOCAL',
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tc_session      ON training_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_tc_user         ON training_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_tc_cefr         ON training_conversations(cefr_level);
CREATE INDEX IF NOT EXISTS idx_tc_has_errors   ON training_conversations(has_errors);
CREATE INDEX IF NOT EXISTS idx_tc_include      ON training_conversations(include_in_dataset);
CREATE INDEX IF NOT EXISTS idx_tc_created      ON training_conversations(created_at);

-- ============================================================
-- Lưu chi tiết từng lỗi sai cụ thể của người dùng
-- Đây là dữ liệu vàng để fine-tune khả năng phát hiện lỗi
-- ============================================================

CREATE TABLE IF NOT EXISTS training_error_samples (
    id                  BIGSERIAL PRIMARY KEY,
    training_conv_id    BIGINT       REFERENCES training_conversations(id) ON DELETE CASCADE,
    session_id          BIGINT       NOT NULL,
    user_id             BIGINT       NOT NULL,
    cefr_level          VARCHAR(4)   NOT NULL,

    -- Lỗi cụ thể
    error_type          VARCHAR(128),    -- grammar, vocabulary, structure, ...
    error_original      TEXT         NOT NULL,   -- từ/cụm từ bị sai
    error_corrected     TEXT,            -- phiên bản đúng
    error_explanation   TEXT,            -- giải thích tại sao sai
    error_severity      VARCHAR(16)  DEFAULT 'MEDIUM',  -- LOW / MEDIUM / HIGH

    -- Full context (user_message + correction cặp đôi — format Alpaca)
    context_user_msg    TEXT,
    context_correction  TEXT,

    -- Dùng cho export JSONL fine-tuning
    alpaca_instruction  TEXT,   -- "Correct the following German sentence"
    alpaca_input        TEXT,   -- câu sai của user
    alpaca_output       TEXT,   -- câu đúng + giải thích

    include_in_dataset  BOOLEAN  NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tes_user       ON training_error_samples(user_id);
CREATE INDEX IF NOT EXISTS idx_tes_cefr       ON training_error_samples(cefr_level);
CREATE INDEX IF NOT EXISTS idx_tes_type       ON training_error_samples(error_type);
CREATE INDEX IF NOT EXISTS idx_tes_severity   ON training_error_samples(error_severity);
CREATE INDEX IF NOT EXISTS idx_tes_include    ON training_error_samples(include_in_dataset);
CREATE INDEX IF NOT EXISTS idx_tes_created    ON training_error_samples(created_at);

-- ============================================================
-- View tổng hợp thống kê dataset (dùng cho admin dashboard)
-- ============================================================
CREATE OR REPLACE VIEW v_training_dataset_stats AS
SELECT
    'conversations'             AS type,
    COUNT(*)                    AS total,
    COUNT(*) FILTER (WHERE include_in_dataset)  AS included,
    COUNT(*) FILTER (WHERE has_errors)          AS with_errors,
    MIN(created_at)             AS first_sample,
    MAX(created_at)             AS last_sample
FROM training_conversations
UNION ALL
SELECT
    'error_samples'             AS type,
    COUNT(*)                    AS total,
    COUNT(*) FILTER (WHERE include_in_dataset)  AS included,
    NULL                        AS with_errors,
    MIN(created_at)             AS first_sample,
    MAX(created_at)             AS last_sample
FROM training_error_samples;
