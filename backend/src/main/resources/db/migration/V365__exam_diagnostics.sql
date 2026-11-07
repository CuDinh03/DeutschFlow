-- Làm mới Luyện thi đợt (f) (07/11/2026): bài chẩn đoán đầu vào. Một dòng mỗi học viên (làm lại thì
-- ghi đè). Ba Teil khách quan lấy từ một đề telc B1 có sẵn, chấm bằng đường luyện đề
-- (mock_exam_practice_progress); Viết và Nói là tự đánh giá 1–4 trong self_json.
-- result_json: {"ratios": {"LESEN": 0.6, ...}} — tỉ lệ điểm đạt từng phần, lộ trình đếm ngược dùng để
-- xếp Teil ưu tiên khi chưa có bài thi thử nào.
CREATE TABLE IF NOT EXISTS exam_diagnostics (
    user_id     BIGINT      PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    exam_id     BIGINT      NOT NULL REFERENCES mock_exams (id) ON DELETE CASCADE,
    self_json   JSONB       NOT NULL DEFAULT '{}'::jsonb,
    result_json JSONB,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ
);
