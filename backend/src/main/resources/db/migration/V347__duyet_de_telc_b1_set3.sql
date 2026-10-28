-- Duyệt đề telc B1 Set 3 (owner duyệt 27/10/2026: "duyệt set 3") — mở cho học viên.
--
-- Cùng quy trình với V346 (Set 2): đặt reviewed = TRUE, is_active = TRUE cho đúng đề này. Nội dung
-- giữ nguyên như V344 (không sửa câu nào). Set 4 vẫn là nháp ("Sắp có").
-- WHERE khoá theo đề + trạng thái nháp để chạy lại hay chạy trên DB đã sửa tay cũng không đụng nhầm.

UPDATE mock_exams
SET reviewed = TRUE,
    is_active = TRUE
WHERE exam_format = 'TELC'
  AND cefr_level = 'B1'
  AND title = 'telc Deutsch B1 — Đề số 3'
  AND reviewed = FALSE;
