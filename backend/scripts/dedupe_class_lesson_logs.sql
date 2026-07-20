-- GỘP các nhật ký buổi dạy TRÙNG (cùng class_id + session_date + session_number).
--
-- Chạy TRƯỚC khi deploy V266 (unique index). Nếu còn bản trùng, migration sẽ thất bại và
-- chặn cả lần deploy.
--
--   psql "$DATABASE_URL" -f backend/scripts/survey_timesheet_data_debt.sql   # xem trước
--   psql "$DATABASE_URL" -f backend/scripts/dedupe_class_lesson_logs.sql     # rồi mới gộp
--
-- VÌ SAO TỒN TẠI BẢN TRÙNG: trước bản vá, createLog không kiểm tra trùng và DB cũng không có
-- ràng buộc. Bấm Lưu hai lần (double-click / mạng chập) là hai bản ghi cho cùng một buổi —
-- tức đếm gấp đôi số buổi, và khi số buổi dùng để tính công thì đó là trả thừa tiền.
--
-- QUY TẮC GIỮ LẠI (ưu tiên giữ nhiều thông tin nhất, và tất định để chạy lại cho cùng kết quả):
--   1. bản có NHIỀU dòng điểm danh nhất
--   2. rồi bản có nhiều trường nội dung khác NULL nhất (topic/homework/note/lesson_id)
--   3. rồi bản có id NHỎ NHẤT (bản ghi đầu tiên)
--
-- AN TOÀN:
--   * Chạy trong một transaction; in số liệu trước/sau.
--   * Điểm danh của bản bị loại được CHUYỂN sang bản giữ lại nếu học viên đó chưa có dòng ở
--     bản giữ — không mất dữ liệu điểm danh. Trùng học viên thì giữ dòng của bản thắng.
--   * Idempotent: chạy lại khi đã sạch là no-op.
--   * KHÔNG đụng tới bản ghi không trùng.

BEGIN;

\echo '--- trước khi gộp ---'
SELECT count(*) AS tong_nhat_ky FROM class_lesson_logs;
SELECT coalesce(sum(n) - count(*), 0) AS ban_ghi_du_ra FROM (
    SELECT count(*) AS n FROM class_lesson_logs
    GROUP BY class_id, session_date, session_number HAVING count(*) > 1) d;

-- Xếp hạng trong từng nhóm trùng; hạng 1 là bản được giữ.
CREATE TEMP TABLE dedupe_plan ON COMMIT DROP AS
SELECT
    l.id,
    first_value(l.id) OVER w AS keep_id
FROM class_lesson_logs l
LEFT JOIN LATERAL (
    SELECT count(*) AS att_n FROM class_attendance a WHERE a.lesson_log_id = l.id
) a ON TRUE
-- Null-safe: `IN (a,b,c)` sẽ trả NULL (không phải TRUE) khi session_number IS NULL, nên nhóm
-- "không đánh số buổi" bị bỏ sót. IS NOT DISTINCT FROM coi hai NULL là bằng nhau — khớp cả
-- GROUP BY ở phần khảo sát lẫn Objects.equals ở tầng service.
WHERE EXISTS (
    SELECT 1 FROM class_lesson_logs d
    WHERE d.class_id = l.class_id
      AND d.session_date = l.session_date
      AND d.session_number IS NOT DISTINCT FROM l.session_number
      AND d.id <> l.id
)
WINDOW w AS (
    PARTITION BY l.class_id, l.session_date, l.session_number
    ORDER BY
        a.att_n DESC,
        ((l.topic IS NOT NULL)::int + (l.homework IS NOT NULL)::int
         + (l.note IS NOT NULL)::int + (l.lesson_id IS NOT NULL)::int) DESC,
        l.id ASC
);

-- 1) Chuyển điểm danh từ bản bị loại sang bản giữ, chỉ khi học viên đó chưa có dòng ở bản giữ.
UPDATE class_attendance a
SET lesson_log_id = p.keep_id
FROM dedupe_plan p
WHERE a.lesson_log_id = p.id
  AND p.id <> p.keep_id
  AND NOT EXISTS (
      SELECT 1 FROM class_attendance k
      WHERE k.lesson_log_id = p.keep_id AND k.student_id = a.student_id
  );

-- 2) Xoá bản bị loại (điểm danh còn sót của chúng đi theo ON DELETE CASCADE của V208).
DELETE FROM class_lesson_logs l
USING dedupe_plan p
WHERE l.id = p.id AND p.id <> p.keep_id;

\echo '--- sau khi gộp ---'
SELECT count(*) AS tong_nhat_ky FROM class_lesson_logs;
SELECT coalesce(sum(n) - count(*), 0) AS ban_ghi_du_ra_con_lai FROM (
    SELECT count(*) AS n FROM class_lesson_logs
    GROUP BY class_id, session_date, session_number HAVING count(*) > 1) d;

COMMIT;

\echo '>>> Nếu "ban_ghi_du_ra_con_lai" = 0 thì deploy được V266.'
