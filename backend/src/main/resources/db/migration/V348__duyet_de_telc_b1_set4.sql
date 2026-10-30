-- Duyệt đề telc B1 Set 4 (owner duyệt 30/10/2026: "duyệt set 4") — mở cho học viên.
--
-- Cùng quy trình với V346, V347: đặt reviewed = TRUE, is_active = TRUE cho đúng đề này. Nội dung
-- giữ nguyên như V345 (không sửa câu nào). Sau migration này không còn đề telc B1 nào là nháp.
-- WHERE khoá theo đề + trạng thái nháp để chạy lại hay chạy trên DB đã sửa tay cũng không đụng nhầm.

UPDATE mock_exams
SET reviewed = TRUE,
    is_active = TRUE
WHERE exam_format = 'TELC'
  AND cefr_level = 'B1'
  AND title = 'telc Deutsch B1 — Đề số 4'
  AND reviewed = FALSE;
