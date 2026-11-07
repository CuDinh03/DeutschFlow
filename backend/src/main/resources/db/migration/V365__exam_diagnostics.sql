-- Làm mới Luyện thi đợt (f) (07/11/2026): bài chẩn đoán đầu vào telc B1. Một dòng mỗi học viên (làm
-- lại thì ghi đè). Lesen T1, Sprachbausteine T1, Hören T1 và Schreiben (AI chấm theo phiếu telc) lấy
-- từ một đề có sẵn, chấm bằng đường luyện đề (mock_exam_practice_progress); Sprechen là lượt thi thử
-- phần nói telc B1 làm sau started_at (speaking_exam_results).
-- result_json: {"ratios": {"LESEN": 0.6, ...}, "skills": {...}, "oralSessionId": 12} — tỉ lệ điểm đạt
-- từng phần; lộ trình đếm ngược dùng để xếp Teil ưu tiên khi chưa có bài thi thử nào.
CREATE TABLE IF NOT EXISTS exam_diagnostics (
    user_id     BIGINT      PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    exam_id     BIGINT      NOT NULL REFERENCES mock_exams (id) ON DELETE CASCADE,
    result_json JSONB,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ
);
