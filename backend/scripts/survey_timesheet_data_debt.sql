-- KHẢO SÁT (CHỈ ĐỌC) hai khoản nợ dữ liệu của cụm chấm công.
--
-- Script này KHÔNG sửa gì. Chạy trước, đọc kết quả, rồi mới quyết định có cần chạy
-- dedupe_class_lesson_logs.sql / cleanup_orphan_class_attendance.sql hay không.
--
--   psql "$DATABASE_URL" -f backend/scripts/survey_timesheet_data_debt.sql
--
-- Vì sao phải khảo sát trước:
--   (1) V266 tạo unique index chống nhật ký trùng buổi. Nếu prod đang có bản trùng thì
--       migration THẤT BẠI và chặn cả lần deploy. Phải biết con số trước.
--   (2) Hàng class_attendance "mồ côi" có thể là DỮ LIỆU THẬT của học viên đã rời lớp,
--       hoặc là rác từ lỗ hổng IDOR cũ (buildAttendance nhận studentId tuỳ ý trước bản vá).
--       Hai thứ trông GIỐNG HỆT nhau trong DB — nên tuyệt đối không dọn tự động.

\echo ''
\echo '════════ 1. NHẬT KÝ TRÙNG BUỔI (chặn V266) ════════'

-- Nhóm theo đúng khoá mà LessonLogService.assertRecordableSession dùng.
-- GROUP BY coi các NULL session_number là bằng nhau — khớp Objects.equals ở tầng service.
SELECT
    count(*)                    AS so_nhom_trung,
    coalesce(sum(n) - count(*), 0) AS so_ban_ghi_du_ra
FROM (
    SELECT class_id, session_date, session_number, count(*) AS n
    FROM class_lesson_logs
    GROUP BY class_id, session_date, session_number
    HAVING count(*) > 1
) d;

\echo '--- chi tiết (tối đa 30 nhóm) ---'
SELECT
    l.class_id,
    c.name                       AS lop,
    l.session_date,
    l.session_number,
    count(*)                     AS so_ban_ghi,
    array_agg(l.id ORDER BY l.id) AS cac_id
FROM class_lesson_logs l
LEFT JOIN teacher_classes c ON c.id = l.class_id
GROUP BY l.class_id, c.name, l.session_date, l.session_number
HAVING count(*) > 1
ORDER BY count(*) DESC, l.class_id
LIMIT 30;

\echo ''
\echo '════════ 2. ĐIỂM DANH "MỒ CÔI" (học viên không còn trong lớp) ════════'
\echo 'PHÂN LOẠI theo dấu vết khác của học viên trong CHÍNH lớp đó:'
\echo '  CO_DAU_VET  = nhiều khả năng là học viên ĐÃ RỜI LỚP → dữ liệu THẬT, ĐỪNG XOÁ'
\echo '  KHONG_DAU_VET = ứng viên rác từ lỗ hổng cũ → vẫn cần người xác nhận'

WITH orphan AS (
    SELECT a.lesson_log_id, a.student_id, l.class_id
    FROM class_attendance a
    JOIN class_lesson_logs l ON l.id = a.lesson_log_id
    WHERE NOT EXISTS (
        SELECT 1 FROM class_students cs
        WHERE cs.class_id = l.class_id AND cs.student_id = a.student_id
    )
), classified AS (
    SELECT o.*,
           EXISTS (  -- đã từng nộp/được giao bài trong lớp này
               SELECT 1 FROM student_assignments sa
               JOIN class_assignments ca ON ca.id = sa.assignment_id
               WHERE ca.class_id = o.class_id AND sa.student_id = o.student_id
           ) AS co_bai_tap,
           EXISTS (  -- tín hiệu phụ: từng xin vào lớp (bảng này không có FK, chỉ tham khảo)
               SELECT 1 FROM classroom_join_requests jr
               WHERE jr.classroom_id = o.class_id AND jr.student_id = o.student_id
           ) AS co_xin_vao_lop
    FROM orphan o
)
SELECT
    CASE WHEN co_bai_tap OR co_xin_vao_lop THEN 'CO_DAU_VET' ELSE 'KHONG_DAU_VET' END AS phan_loai,
    count(*)                        AS so_hang,
    count(DISTINCT student_id)      AS so_hoc_vien,
    count(DISTINCT class_id)        AS so_lop
FROM classified
GROUP BY 1
ORDER BY 1;

\echo '--- mẫu hàng KHONG_DAU_VET (tối đa 30) — soi kỹ trước khi quyết ---'
WITH orphan AS (
    SELECT a.lesson_log_id, a.student_id, a.status, l.class_id, l.session_date
    FROM class_attendance a
    JOIN class_lesson_logs l ON l.id = a.lesson_log_id
    WHERE NOT EXISTS (
        SELECT 1 FROM class_students cs
        WHERE cs.class_id = l.class_id AND cs.student_id = a.student_id
    )
)
SELECT o.class_id, c.name AS lop, o.session_date, o.student_id,
       u.email AS email_hoc_vien, u.role AS vai_tro, o.status
FROM orphan o
LEFT JOIN teacher_classes c ON c.id = o.class_id
LEFT JOIN users u           ON u.id = o.student_id
WHERE NOT EXISTS (
        SELECT 1 FROM student_assignments sa
        JOIN class_assignments ca ON ca.id = sa.assignment_id
        WHERE ca.class_id = o.class_id AND sa.student_id = o.student_id)
  AND NOT EXISTS (
        SELECT 1 FROM classroom_join_requests jr
        WHERE jr.classroom_id = o.class_id AND jr.student_id = o.student_id)
ORDER BY o.class_id, o.session_date
LIMIT 30;

\echo ''
\echo '>>> DẤU HIỆU BỊ KHAI THÁC: nếu cột vai_tro ở trên có TEACHER/ADMIN/MANAGER, hoặc một'
\echo '>>> lớp có hàng chục học viên KHONG_DAU_VET với id liên tiếp, thì gần như chắc chắn là'
\echo '>>> rác do lỗ hổng IDOR cũ. Nếu bảng trên RỖNG thì prod chưa từng bị khai thác.'
\echo ''
\echo '════════ 3. TRẠNG THÁI ĐIỂM DANH LỆCH CHUẨN (CHECK của V265 đang NOT VALID) ════════'
SELECT status, count(*) AS so_hang
FROM class_attendance
WHERE status NOT IN ('PRESENT', 'LATE', 'ABSENT')
GROUP BY status
ORDER BY count(*) DESC;
\echo '(rỗng ⇒ chạy được: ALTER TABLE class_attendance VALIDATE CONSTRAINT chk_class_attendance_status;)'
