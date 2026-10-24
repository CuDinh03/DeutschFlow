-- ============================================================
-- V335: Lớp câu hỏi theo nghề + từ chuyên môn (19/10/2026, đợt 2b định hướng A + B + E)
--
-- Khung phỏng vấn hai lớp: lớp chung (bank / interview_question theo nhân vật) + lớp nghề ở đây.
-- Nội dung do AI tạo cho nghề dùng bộ chung (occupation.legacy_persona_code IS NULL); 49 nghề có
-- bộ viết tay của nhân vật thì bộ đó chính là lớp nghề, không sinh thêm.
--
-- status: AI_GENERATED (mặc định, được dùng trong phiên, gắn nhãn "AI tạo") → APPROVED (người duyệt
-- ngôn ngữ đã đọc, gắn nhãn "Đã duyệt") hoặc REJECTED (không bao giờ hỏi lại).
-- Người duyệt: giáo viên tiếng Đức; 10 nghề đầu thêm một người đang làm nghề ở Đức (quyết định 6).
--
-- ai_speaking_sessions.occupation_code: nghề của phiên phỏng vấn — thứ tự ưu tiên hàng duyệt
-- (nghề được chọn nhiều duyệt trước). Không FK để xoá/tắt nghề không đụng tới lịch sử phiên.
-- ============================================================

CREATE TABLE IF NOT EXISTS occupation_question (
    id               VARCHAR(100) PRIMARY KEY,
    occupation_code  VARCHAR(64)  NOT NULL REFERENCES occupation (code),
    phase            VARCHAR(30)  NOT NULL DEFAULT 'HARD_SKILLS',
    topic_key        VARCHAR(80)  NOT NULL,
    question_de      TEXT         NOT NULL,
    difficulty       VARCHAR(20)  NOT NULL DEFAULT 'INTERMEDIATE',
    status           VARCHAR(20)  NOT NULL DEFAULT 'AI_GENERATED',
    source_model     VARCHAR(80),
    reviewed_by      BIGINT,
    reviewed_at      TIMESTAMP,
    review_note      VARCHAR(500),
    created_at       TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_occupation_question_status CHECK (status IN ('AI_GENERATED', 'APPROVED', 'REJECTED')),
    CONSTRAINT chk_occupation_question_difficulty CHECK (difficulty IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED'))
);

CREATE INDEX IF NOT EXISTS idx_occupation_question_lookup ON occupation_question (occupation_code, phase, status);
CREATE INDEX IF NOT EXISTS idx_occupation_question_status ON occupation_question (status, created_at);

CREATE TABLE IF NOT EXISTS occupation_term (
    id               BIGSERIAL    PRIMARY KEY,
    occupation_code  VARCHAR(64)  NOT NULL REFERENCES occupation (code),
    term_de          VARCHAR(120) NOT NULL,
    meaning_en       VARCHAR(200) NOT NULL,
    meaning_vi       VARCHAR(200) NOT NULL,
    example_de       VARCHAR(300),
    status           VARCHAR(20)  NOT NULL DEFAULT 'AI_GENERATED',
    source_model     VARCHAR(80),
    reviewed_by      BIGINT,
    reviewed_at      TIMESTAMP,
    review_note      VARCHAR(500),
    created_at       TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_occupation_term_status CHECK (status IN ('AI_GENERATED', 'APPROVED', 'REJECTED')),
    CONSTRAINT uq_occupation_term UNIQUE (occupation_code, term_de)
);

CREATE INDEX IF NOT EXISTS idx_occupation_term_status ON occupation_term (status, created_at);

ALTER TABLE ai_speaking_sessions ADD COLUMN IF NOT EXISTS occupation_code VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_ai_speaking_sessions_occupation
    ON ai_speaking_sessions (occupation_code) WHERE occupation_code IS NOT NULL;
