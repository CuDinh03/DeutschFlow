-- Đánh dấu bài đọc khi luyện thi (09/11/2026, kế hoạch "đánh dấu bài đọc" đợt 1).
--
-- Học viên bôi đen chữ trong bài đọc / đề câu hỏi để tô màu, gạch chân, gắn vào số câu, ghi chú, và
-- gạch bỏ phương án đã loại — như làm đề trên giấy. Mỗi hàng = gói đánh dấu của MỘT người trên MỘT Teil:
--   attempt_id IS NULL      chế độ luyện Teil (mock_exam_practice_progress), một hàng / người × đề × Teil
--   attempt_id IS NOT NULL  một lượt thi thử (đợt 2), một hàng / lượt × Teil
--
-- Bảng riêng, không thêm cột vào bảng tiến độ / nháp thi thử, vì:
--   • "Làm lại" xoá hàng tiến độ, còn đánh dấu được giữ nếu người học chọn giữ;
--   • có hàng tiến độ = Teil "đang làm dở" — đánh dấu không được làm đổi trạng thái đó;
--   • nháp thi thử có khoá phiên bản (draft_version): lưu đánh dấu chung sẽ tranh khoá với lưu đáp án.
--
-- marks_json (kiểm ở PassageMarksValidator): { v, blocks{khối: hash}, marks[{id,g,b,s,e,k,c,q,n}],
-- struck{idCâu: [phương án]} }. Vị trí s/e là ký tự trên chữ của khối (ctx = bài đọc, q:<id> = đề câu);
-- hash khối lệch (đề bị sửa chữ) ⇒ client bỏ đánh dấu của khối đó.
--
-- Chỉ thêm bảng ⇒ tương thích ngược khi blue-green. Xoá người dùng / đề / lượt ⇒ xoá theo.

CREATE TABLE exam_passage_marks (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exam_id     BIGINT       NOT NULL REFERENCES mock_exams(id) ON DELETE CASCADE,
    teil_key    VARCHAR(40)  NOT NULL,
    attempt_id  BIGINT       REFERENCES mock_exam_attempts(id) ON DELETE CASCADE,
    marks_json  JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_passage_marks_practice
    ON exam_passage_marks (user_id, exam_id, teil_key) WHERE attempt_id IS NULL;

CREATE UNIQUE INDEX uq_passage_marks_attempt
    ON exam_passage_marks (attempt_id, teil_key) WHERE attempt_id IS NOT NULL;
