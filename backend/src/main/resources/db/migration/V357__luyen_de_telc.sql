-- Luyện đề telc trên web (03/11/2026) — chế độ làm TỪNG Teil, kiểm tra xong có phân tích từng câu.
--
-- Hai bảng mới, không đụng bảng cũ (tương thích ngược cho blue-green):
--   mock_exam_practice_progress  tiến độ luyện của MỘT học viên trên MỘT Teil: đáp án nháp, đã kiểm
--                                tra chưa, điểm, thời gian, và phân tích lưu lại để mở lại không chấm
--                                lại. Teil Viết lưu kết quả chấm AI ở result_json.
--   mock_exam_explanations       phần giải thích bổ sung cho từng Teil của từng đề: nghĩa từng lựa
--                                chọn, ý chính của từng bài, dấu hiệu trong bài, VÌ SAO từng phương án
--                                sai. Tách khỏi sections_json để không phải viết lại JSON đề đã duyệt
--                                và để /questions không bao giờ lộ phần này trước khi kiểm tra.
--
-- Cờ truy cập (đọc thẳng DB mỗi lần, không qua cache): practice.telc.access = OFF | ALLOWLIST | ALL;
-- practice.telc.allowlist = id hoặc email người dùng, ngăn cách bằng dấu phẩy. ADMIN luôn vào được.
-- Mặc định ALLOWLIST rỗng: học viên chưa thấy gì cho tới khi owner thêm tài khoản test.

CREATE TABLE mock_exam_practice_progress (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exam_id         BIGINT       NOT NULL REFERENCES mock_exams(id) ON DELETE CASCADE,
    teil_key        VARCHAR(40)  NOT NULL,
    answers_json    JSONB        NOT NULL DEFAULT '{}'::jsonb,
    checked         BOOLEAN      NOT NULL DEFAULT FALSE,
    score           NUMERIC(6,2),
    max_score       NUMERIC(6,2),
    elapsed_seconds INT          NOT NULL DEFAULT 0,
    result_json     JSONB,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    checked_at      TIMESTAMPTZ,
    CONSTRAINT uq_practice_progress UNIQUE (user_id, exam_id, teil_key)
);

CREATE INDEX idx_practice_progress_user_exam ON mock_exam_practice_progress (user_id, exam_id);

CREATE TABLE mock_exam_explanations (
    exam_id   BIGINT      NOT NULL REFERENCES mock_exams(id) ON DELETE CASCADE,
    teil_key  VARCHAR(40) NOT NULL,
    body      JSONB       NOT NULL,
    PRIMARY KEY (exam_id, teil_key)
);

INSERT INTO system_config (config_key, config_value, description, updated_at)
VALUES ('practice.telc.access', 'ALLOWLIST',
        'Luyện đề telc trên web: OFF | ALLOWLIST | ALL', NOW()),
       ('practice.telc.allowlist', '',
        'Id hoặc email được vào luyện đề khi access = ALLOWLIST, ngăn cách bằng dấu phẩy', NOW())
ON CONFLICT (config_key) DO NOTHING;
