-- ============================================================
-- V130: AI Job Queue + Prompt Templates
-- Database-level queue using FOR UPDATE SKIP LOCKED
-- Scope: PRONUNCIATION_EVAL + INTERVIEW_REPORT
-- ============================================================

CREATE TABLE ai_jobs (
    id           BIGSERIAL    PRIMARY KEY,
    job_type     VARCHAR(64)  NOT NULL,  -- 'PRONUNCIATION_EVAL' | 'INTERVIEW_REPORT'
    status       VARCHAR(16)  NOT NULL DEFAULT 'PENDING',  -- PENDING | PROCESSING | COMPLETED | FAILED
    user_id      BIGINT       NOT NULL,
    payload      JSONB        NOT NULL,  -- input (originalText, transcribedText, focusPhonemes, sessionId, ...)
    result       JSONB        NULL,      -- output từ AI sau khi xử lý xong
    error_msg    TEXT         NULL,
    retry_count  INT          NOT NULL DEFAULT 0,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_ai_jobs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_ai_jobs_status_created ON ai_jobs (status, created_at)
    WHERE status IN ('PENDING', 'PROCESSING');

-- ──────────────────────────────────────────────────────────────
-- Prompt Templates: version-controlled, hot-swappable
-- ──────────────────────────────────────────────────────────────
CREATE TABLE prompt_templates (
    id          BIGSERIAL     PRIMARY KEY,
    key         VARCHAR(128)  NOT NULL,       -- 'PRONUNCIATION_EVAL_VI' | 'INTERVIEW_REPORT_VI' | etc.
    version_id  INT           NOT NULL DEFAULT 1,
    content     TEXT          NOT NULL,
    model_hint  VARCHAR(64)   NULL,           -- metadata: gợi ý model (không bắt buộc dùng)
    is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
    notes       TEXT          NULL,           -- ghi chú về lý do thay đổi
    created_at  TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- Chỉ 1 version active cho mỗi key tại một thời điểm
CREATE UNIQUE INDEX idx_prompt_templates_key_active
    ON prompt_templates (key) WHERE is_active = TRUE;

-- Seed initial prompts (same as current hardcoded prompts, moved to DB)
INSERT INTO prompt_templates (key, version_id, content, model_hint, notes) VALUES
(
    'PRONUNCIATION_EVAL_VI',
    1,
    'Bạn là chuyên gia ngữ âm học tiếng Đức, chuyên dạy cho người Việt Nam. Nhiệm vụ của bạn là phân tích lỗi phát âm dựa trên danh sách từ SAI được cung cấp. Trả về JSON với format: {"wordTips": [{"word": "...", "tip": "..."}]}. Giải thích ngắn gọn, thực tế, dùng so sánh với tiếng Việt khi có thể. Tối đa 2 tips.',
    'llama-3.3-70b-versatile',
    'Initial version - Vietnamese phonetics expert persona'
),
(
    'INTERVIEW_REPORT_VI',
    1,
    'Bạn là chuyên gia đánh giá kỹ năng ngôn ngữ tiếng Đức. Phân tích toàn bộ cuộc hội thoại phỏng vấn và trả về JSON: {"overallScore": 0-100, "fluencyScore": 0-100, "grammarScore": 0-100, "vocabularyScore": 0-100, "strengths": ["...", "..."], "improvements": ["...", "..."], "summaryVi": "Tổng quan bằng tiếng Việt"}.',
    'llama-3.3-70b-versatile',
    'Initial version - Interview evaluation'
);
