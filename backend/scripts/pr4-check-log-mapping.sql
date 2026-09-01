-- Cổng nâng cấp dữ liệu cũ cho V293 (plan §7.2, PR-4) — chạy trên PROD (read-only) TRƯỚC merge.
-- V293 backfill session_id cho nhật ký cũ CHỈ khi ngày đó lớp có đúng MỘT buổi; script này báo
-- trước số lượng từng nhóm để không có bất ngờ sau migrate (nhóm legacy còn lại là HỢP LỆ —
-- đường date+number vẫn hoạt động, không cần xử lý tay trừ khi muốn dọn).
--
--   ~/Developer/deutschflow-tools/run-pr3-gate.sh <đường-dẫn-file-này>   (tái dùng tunnel tool)
-- Lưu ý: tool mặc định phán kiểu gate (rỗng = PASS); kết quả script này LUÔN có 1 dòng tổng —
-- đọc số liệu, không cần "PASS".

SELECT
    COUNT(*)                                                                   AS tong_nhat_ky,
    COUNT(*) FILTER (WHERE m.cnt = 1)                                          AS se_map_duoc,
    COUNT(*) FILTER (WHERE m.cnt IS NULL)                                      AS ngay_khong_co_buoi,
    COUNT(*) FILTER (WHERE m.cnt >= 2)                                         AS ngay_nhieu_buoi
FROM class_lesson_logs l
LEFT JOIN (
    SELECT class_id, (start_at::date) AS d, COUNT(*) AS cnt
    FROM class_sessions
    GROUP BY class_id, (start_at::date)
) m ON m.class_id = l.class_id AND m.d = l.session_date;
