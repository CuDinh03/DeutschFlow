-- ============================================================
-- V262: class_sessions.original_date — ô lịch gốc của buổi sinh từ mẫu định kỳ
-- ============================================================
-- Dời một buổi sang thứ khác (updateSession đặt start_at mới + is_overridden = true) làm mất dấu
-- ô lịch mà buổi đó vốn chiếm. regenerate() tính keptDates theo start_at HIỆN TẠI, nên ngày gốc
-- trông như còn trống và bị sinh lại → lớp có thêm một buổi "ma" trên ngày cũ, tồn tại song song
-- với buổi đã dời. Học viên thấy cả hai.
--
-- original_date ghi lại ô lịch gốc để regenerate biết ô đó đã có chủ.
--
-- Additive, backward-compatible:
--   - NULLABLE: bản ghi cũ giữ NULL và regenerate quay về hành vi cũ (neo theo start_at) cho các
--     bản ghi đó → không đổi hành vi ngoài ý muốn với dữ liệu sẵn có.
--   - KHÔNG backfill: buổi chưa từng bị dời thì original_date suy ra đúng bằng ngày của start_at
--     (chính là fallback), còn buổi đã bị dời thì ngày gốc đã mất và không khôi phục chính xác
--     được — để NULL là cách trung thực, thay vì ghi một giá trị sai.
-- ============================================================

ALTER TABLE class_sessions
    ADD COLUMN IF NOT EXISTS original_date DATE;

COMMENT ON COLUMN class_sessions.original_date IS
    'Ngày của ô lịch gốc sinh từ class_schedule_patterns. Giữ nguyên khi buổi bị dời sang ngày khác để regenerate không sinh lại ô đã có chủ. NULL = bản ghi trước V262 hoặc buổi tạo tay.';
