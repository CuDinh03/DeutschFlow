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
--
-- class_attendance có PRIMARY KEY (lesson_log_id, student_id) nên mỗi (bản giữ, học viên) chỉ được
-- nhận ĐÚNG MỘT dòng. DISTINCT ON là phần bắt buộc: bản trước dùng một UPDATE với NOT EXISTS, mà mọi
-- dòng trong cùng một câu lệnh đều thấy CÙNG một ảnh chụp — nên khi một nhóm trùng có từ 3 bản trở
-- lên và cùng một học viên được đánh dấu ở HAI bản thua nhưng không có ở bản giữ, cả hai dòng đều
-- qua được NOT EXISTS và cùng chuyển về bản giữ → vi phạm khoá chính và script abort giữa chừng.
-- Chỉ chuyển một dòng; dòng thừa nằm lại ở bản thua và biến mất theo ON DELETE CASCADE ở bước 2.
WITH movable AS (
    SELECT DISTINCT ON (p.keep_id, a.student_id)
           a.lesson_log_id AS from_log,
           a.student_id,
           p.keep_id
    FROM class_attendance a
    JOIN dedupe_plan p ON p.id = a.lesson_log_id
    WHERE p.id <> p.keep_id
      AND NOT EXISTS (
          SELECT 1 FROM class_attendance k
          WHERE k.lesson_log_id = p.keep_id AND k.student_id = a.student_id
      )
    ORDER BY p.keep_id, a.student_id, a.lesson_log_id   -- tất định: lấy dòng ở bản thua có id nhỏ nhất
)
UPDATE class_attendance a
SET lesson_log_id = m.keep_id
FROM movable m
WHERE a.lesson_log_id = m.from_log
  AND a.student_id   = m.student_id;

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
