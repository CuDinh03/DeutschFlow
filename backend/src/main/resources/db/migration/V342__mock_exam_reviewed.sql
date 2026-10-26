-- Cờ duyệt nội dung cho đề thi thử (26/10/2026) — đi trước bộ nháp telc B1 Set 2–4 (V343–V345).
--
-- Đề AI soạn nháp phải được người duyệt trước khi học viên làm (owner chốt 21/10, câu 8 kế hoạch
-- sau 2d+2e). Đề nháp mang reviewed = FALSE **và** is_active = FALSE:
--   • is_active = FALSE ⇒ mọi đường cũ (catalog, gợi ý đề, đếm đề, bản backend cũ còn chạy trong
--     lúc blue-green hay sau rollback) đều không thấy đề — không lộ đề nháp thành đề thường.
--   • reviewed = FALSE ⇒ đường mới hiện đề đó với nhãn "Sắp có" (không bấm được) và chặn
--     /start, /questions kể cả khi gọi thẳng id.
-- Duyệt xong = một migration đặt reviewed = TRUE, is_active = TRUE cho đúng đề đó.
--
-- Mọi đề đang có là đề đã dùng thật ⇒ mặc định TRUE. Chỉ thêm cột có mặc định: tương thích ngược.

ALTER TABLE mock_exams ADD COLUMN IF NOT EXISTS reviewed BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN mock_exams.reviewed IS
    'FALSE = đề nháp chờ người duyệt: học viên chỉ thấy nhãn Sắp có, không làm được (đi kèm is_active = FALSE).';
