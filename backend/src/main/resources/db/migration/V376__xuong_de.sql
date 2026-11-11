-- Xưởng đề (09/11/2026): admin tạo một Teil đề thi từ nguồn báo Đức; AI rút dữ kiện, viết bài mới và ra
-- câu hỏi theo ma trận độ khó 4 bậc (EASY/MEDIUM/HARD/EXPERT); owner duyệt rồi Teil vào kho.
-- Thiết kế: plans/2026-11-09-thiet-ke-co-che-tao-de.md (LOCAL). Đợt 1 chỉ telc · B1 · LESEN · Teil 2.
--
-- Luật nguồn (owner chốt 07/11/2026): báo có bản quyền chỉ lấy chủ đề và dữ kiện, viết bài mới; chỉ
-- nguồn CC BY mới được chuyển thể. Vì vậy bảng nguồn KHÔNG có cột nội dung bài gốc: chỉ dữ kiện đã
-- viết lại (facts_json) và hash các cụm 6 từ của bài gốc (shingle_hashes) để kiểm chép nguyên văn —
-- từ hash không dựng lại được văn bản.

CREATE TABLE IF NOT EXISTS exam_sources (
    id                    BIGSERIAL    PRIMARY KEY,
    url                   TEXT,
    publisher             VARCHAR(300),
    title                 TEXT,
    author                VARCHAR(500),
    published_at          VARCHAR(40),
    license_text          VARCHAR(500),
    -- ADAPT = được chuyển thể (CC BY); FACTS_ONLY = chỉ dữ kiện (báo có bản quyền, CC BY-SA, NC, ND, không rõ)
    usage_mode            VARCHAR(20)  NOT NULL DEFAULT 'FACTS_ONLY'
                          CHECK (usage_mode IN ('ADAPT', 'FACTS_ONLY')),
    usage_mode_confirmed  BOOLEAN      NOT NULL DEFAULT FALSE,
    neutrality            VARCHAR(20)  NOT NULL DEFAULT 'OK' CHECK (neutrality IN ('OK', 'FLAGGED')),
    neutrality_reason     TEXT,
    facts_json            JSONB        NOT NULL DEFAULT '[]'::jsonb,
    shingle_hashes        JSONB        NOT NULL DEFAULT '[]'::jsonb,
    created_by            BIGINT       REFERENCES users (id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exam_teil_blocks (
    id             BIGSERIAL    PRIMARY KEY,
    exam_format    VARCHAR(30)  NOT NULL,
    cefr_level     VARCHAR(5)   NOT NULL,
    section        VARCHAR(40)  NOT NULL,
    teil           INT          NOT NULL,
    teil_type      VARCHAR(60)  NOT NULL,
    theme          VARCHAR(120),
    -- Đúng khuôn một phần tử teile[] của mock_exams.sections_json (+ source, difficulty_* từng câu)
    content_json   JSONB        NOT NULL,
    status         VARCHAR(20)  NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('APPROVED', 'RETIRED')),
    origin         VARCHAR(20)  NOT NULL DEFAULT 'STUDIO' CHECK (origin IN ('SEED', 'STUDIO', 'HUMAN')),
    content_hash   VARCHAR(64)  NOT NULL,
    exposure_count INT          NOT NULL DEFAULT 0,
    reviewed_by    BIGINT       REFERENCES users (id) ON DELETE SET NULL,
    reviewed_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_exam_teil_blocks_hash ON exam_teil_blocks (content_hash);
CREATE INDEX IF NOT EXISTS idx_exam_teil_blocks_slot
    ON exam_teil_blocks (exam_format, cefr_level, section, teil, status);

CREATE TABLE IF NOT EXISTS exam_drafts (
    id                BIGSERIAL    PRIMARY KEY,
    exam_format       VARCHAR(30)  NOT NULL,
    cefr_level        VARCHAR(5)   NOT NULL,
    section           VARCHAR(40)  NOT NULL,
    teil              INT          NOT NULL,
    teil_type         VARCHAR(60)  NOT NULL,
    theme             VARCHAR(120),
    mode              VARCHAR(20)  NOT NULL DEFAULT 'EXAM' CHECK (mode IN ('EXAM', 'PRACTICE')),
    difficulty_plan   JSONB        NOT NULL,
    step              VARCHAR(20)  NOT NULL DEFAULT 'FRAME'
                      CHECK (step IN ('FRAME', 'SOURCE', 'TEXT', 'ITEMS', 'REVIEW', 'APPROVED')),
    status            VARCHAR(20)  NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'DISCARDED')),
    -- Thao tác AI đang chạy (FACTS/TEXT/ITEMS/ITEM/VERIFY); NULL = rảnh. Đặt bằng UPDATE … WHERE busy_op IS NULL.
    busy_op           VARCHAR(20),
    busy_job_id       BIGINT,
    last_error        TEXT,
    text_json         JSONB,
    items_json        JSONB        NOT NULL DEFAULT '[]'::jsonb,
    checks_json       JSONB        NOT NULL DEFAULT '[]'::jsonb,
    -- hash(text+items) lúc tự kiểm; duyệt chỉ được khi nội dung chưa đổi kể từ lần tự kiểm.
    verified_hash     VARCHAR(64),
    review_checklist  JSONB        NOT NULL DEFAULT '{}'::jsonb,
    block_id          BIGINT       REFERENCES exam_teil_blocks (id) ON DELETE SET NULL,
    created_by        BIGINT       REFERENCES users (id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_exam_drafts_status ON exam_drafts (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS exam_draft_sources (
    draft_id    BIGINT NOT NULL REFERENCES exam_drafts (id) ON DELETE CASCADE,
    source_id   BIGINT NOT NULL REFERENCES exam_sources (id) ON DELETE CASCADE,
    position    INT    NOT NULL DEFAULT 0,
    PRIMARY KEY (draft_id, source_id)
);

-- Đề ghép từ kho Teil (đợt 2) phân biệt với đề viết tay trong migration.
ALTER TABLE mock_exams ADD COLUMN IF NOT EXISTS origin VARCHAR(20) NOT NULL DEFAULT 'HANDWRITTEN';
ALTER TABLE mock_exams ADD COLUMN IF NOT EXISTS block_ids JSONB;
