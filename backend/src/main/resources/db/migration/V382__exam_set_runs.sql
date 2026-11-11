-- Xưởng đề — lượt "Tạo bộ đề tự động" (PR 2 của dây chuyền, owner chốt plan 12/11/2026).
--
-- exam_set_runs      : một lần bấm "Tạo bộ đề" = một lượt chạy cho một kỳ thi + cấp.
-- exam_set_run_teile : mỗi Teil của lượt, trỏ tới bản nháp exam_drafts mà bộ điều phối đang đẩy qua các bước
--                      (nguồn → bài → câu hỏi → tự kiểm → tự sửa). Owner vẫn mở được bản nháp đó trong trình 5 bước.
-- Chỉ thêm bảng mới: màu cũ vẫn chạy được trong lúc blue-green.

CREATE TABLE IF NOT EXISTS exam_set_runs (
    id           BIGSERIAL    PRIMARY KEY,
    exam_format  VARCHAR(30)  NOT NULL,
    cefr_level   VARCHAR(5)   NOT NULL,
    status       VARCHAR(20)  NOT NULL DEFAULT 'PLANNING'
                 CHECK (status IN ('PLANNING', 'RUNNING', 'REVIEW', 'NEEDS_ATTENTION', 'APPROVED', 'DISCARDED')),
    channel      VARCHAR(20)  NOT NULL DEFAULT 'FIREWORKS',
    profile      VARCHAR(20)  NOT NULL DEFAULT 'REAL',
    plan_json    JSONB        NOT NULL DEFAULT '{}'::jsonb,
    report_json  JSONB        NOT NULL DEFAULT '{}'::jsonb,
    note         TEXT,
    mock_exam_id BIGINT,
    created_by   BIGINT       REFERENCES users (id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    finished_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_exam_set_runs_status ON exam_set_runs (status, created_at DESC);

CREATE TABLE IF NOT EXISTS exam_set_run_teile (
    id                 BIGSERIAL    PRIMARY KEY,
    run_id             BIGINT       NOT NULL REFERENCES exam_set_runs (id) ON DELETE CASCADE,
    section            VARCHAR(40)  NOT NULL,
    teil               INT          NOT NULL,
    draft_id           BIGINT       REFERENCES exam_drafts (id) ON DELETE SET NULL,
    status             VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                       CHECK (status IN ('PENDING', 'RUNNING', 'READY', 'STUCK')),
    stage              VARCHAR(20)  NOT NULL DEFAULT 'NEW',
    theme              VARCHAR(120),
    theme_try          INT          NOT NULL DEFAULT 0,
    repair_round       INT          NOT NULL DEFAULT 0,
    errors             INT          NOT NULL DEFAULT 0,
    source_tries       INT          NOT NULL DEFAULT 0,
    pending_article_id BIGINT,
    repair_queue       JSONB        NOT NULL DEFAULT '[]'::jsonb,
    last_error         TEXT,
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (run_id, section, teil)
);
