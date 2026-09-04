-- Cổng nâng cấp dữ liệu cũ cho V292 (plan §7.2, PR-3) — chạy trên BẢN SAO dữ liệu thật TRƯỚC merge.
-- V292 tạo UNIQUE (pattern_id, original_date) trên buổi CHƯA override; nếu dữ liệu tiền-V262 còn
-- buổi "ma" trùng ô thì migration sẽ fail có chủ đích. Script này liệt kê từng ca kèm số bản ghi
-- chấm công đang trỏ vào để xử lý TAY (không tự xoá — buổi ma có thể đã được ghi công).
--
--   psql "$DATABASE_URL" -f backend/scripts/pr3-check-duplicate-pattern-slots.sql
-- Kết quả rỗng = an toàn merge V292.

SELECT s.pattern_id,
       COALESCE(s.original_date, s.start_at::date) AS slot_date,
       COUNT(*)                                    AS dup_sessions,
       ARRAY_AGG(s.id ORDER BY s.id)               AS session_ids,
       ARRAY_AGG(s.start_at ORDER BY s.id)         AS start_ats,
       SUM((SELECT COUNT(*) FROM teacher_session_record r WHERE r.session_id = s.id)) AS timesheet_records
FROM class_sessions s
WHERE s.pattern_id IS NOT NULL
  AND s.is_overridden = false
GROUP BY s.pattern_id, COALESCE(s.original_date, s.start_at::date)
HAVING COUNT(*) > 1
ORDER BY s.pattern_id, slot_date;
