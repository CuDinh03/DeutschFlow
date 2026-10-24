-- ============================================================
-- V339: Bản dịch câu hỏi lớp nghề (22/10/2026, K4 định hướng A + B + E)
--
-- Trang /phong-van/[nghe] hiện bản dịch dưới câu tiếng Đức theo ngôn ngữ trang (vi → Việt,
-- en → Anh, de → không). Bộ sinh lớp nghề trả kèm hai bản dịch từ nay; câu sinh trước V339 được
-- dịch bù qua POST /api/admin/occupations/translations/backfill. Để trống = chưa dịch, trang chỉ
-- hiện câu tiếng Đức. Người duyệt sửa được bản dịch cùng lúc với câu gốc.
-- ============================================================

ALTER TABLE occupation_question ADD COLUMN IF NOT EXISTS question_vi TEXT;
ALTER TABLE occupation_question ADD COLUMN IF NOT EXISTS question_en TEXT;
