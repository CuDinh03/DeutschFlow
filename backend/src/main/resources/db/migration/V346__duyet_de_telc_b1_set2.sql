-- Duyệt đề telc B1 Set 2 (owner duyệt 27/10/2026: "duyệt set 2") — mở cho học viên.
--
-- Đúng quy trình của V342: duyệt = đặt reviewed = TRUE, is_active = TRUE cho đúng đề đó. Nội dung
-- giữ nguyên như V343 (không sửa câu nào). Set 3, Set 4 vẫn là nháp ("Sắp có").
-- WHERE khoá theo đề + trạng thái nháp để chạy lại hay chạy trên DB đã sửa tay cũng không đụng nhầm.

UPDATE mock_exams
SET reviewed = TRUE,
    is_active = TRUE
WHERE exam_format = 'TELC'
  AND cefr_level = 'B1'
  AND title = 'telc Deutsch B1 — Đề số 2'
  AND reviewed = FALSE;
