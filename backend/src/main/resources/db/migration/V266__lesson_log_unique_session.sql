-- ============================================================
-- V266: GỘP nhật ký trùng buổi, rồi chặn trùng ở TẦNG DB
-- ============================================================
-- VÌ SAO GỘP DEDUPE VÀO CHÍNH MIGRATION (thay vì bắt chạy script tay trước khi deploy):
--
-- Bản trước của migration này chỉ tạo index và ghi trong comment rằng người vận hành PHẢI chạy
-- survey + dedupe trước. Điều đó không an toàn vì hai lẽ:
--   1. Yêu cầu đó không tồn tại ở bất kỳ nơi nào người deploy thực sự đọc — deploy-backend.sh và
--      runbook đều không nhắc tới migration. Bỏ sót là CREATE UNIQUE INDEX thất bại giữa chừng,
--      Spring context fail, deploy abort, và schema kẹt ở V265 (Flyway forward-only, không có
--      script hoàn tác).
--   2. Kể cả chạy dedupe tay đúng, vẫn còn CỬA SỔ ĐUA: container CŨ tiếp tục nhận ghi nhật ký cho
--      tới lúc container mới được promote, nên bản trùng mới có thể xuất hiện SAU khi dọn.
--
-- Đặt dedupe và tạo index trong CÙNG migration giải quyết cả hai: Flyway chạy migration trong một
-- transaction, và CREATE UNIQUE INDEX (không CONCURRENTLY) khoá ghi trên bảng, nên không có khe nào
-- để bản trùng mới chen vào giữa bước dọn và bước khoá.
--
-- Phần DML dưới đây là bản đã sửa lỗi của backend/scripts/dedupe_class_lesson_logs.sql (script đó
-- vẫn giữ để khảo sát/dọn thủ công khi cần). Nó IDEMPOTENT: trên CSDL đã sạch thì không đụng dòng nào.
--
-- VÌ SAO CẦN INDEX, dù tầng service đã chặn: LessonLogService.assertRecordableSession chỉ chặn được
-- đường đi qua service. Nó KHÔNG chặn hai request đồng thời (kiểm tra rồi mới ghi, không có khoá),
-- cũng không chặn script backfill hay endpoint mới ghi thẳng vào bảng. Số buổi là căn cứ tính công
-- giáo viên, nên ràng buộc cuối cùng phải nằm ở DB.
--
-- HAI index vì ngữ nghĩa NULL của Postgres: trong UNIQUE index, mọi NULL được coi là KHÁC nhau,
-- nên một index đơn trên (class_id, session_date, session_number) sẽ KHÔNG chặn được hai bản ghi
-- cùng ngày mà session_number đều NULL. Tách thành hai index bộ phận mới phủ đủ:
--   * có đánh số buổi  → khoá theo (lớp, ngày, số buổi)
--   * không đánh số buổi → khoá theo (lớp, ngày)
-- Cách này khớp đúng với phép so ở tầng service (Objects.equals, coi hai NULL là bằng nhau).
-- ============================================================

-- ── Bước 1: xếp hạng các bản trong từng nhóm trùng; hạng 1 là bản được GIỮ ────────────────
-- Quy tắc giữ (ưu tiên nhiều thông tin nhất, tất định để chạy lại ra cùng kết quả):
--   1. nhiều dòng điểm danh nhất → 2. nhiều trường nội dung khác NULL nhất → 3. id nhỏ nhất.
-- IS NOT DISTINCT FROM: coi hai NULL là bằng nhau, nếu không nhóm "không đánh số buổi" bị bỏ sót
-- (`= NULL` trả NULL chứ không phải TRUE).
CREATE TEMP TABLE dedupe_plan AS
SELECT
    l.id,
    first_value(l.id) OVER w AS keep_id
FROM class_lesson_logs l
LEFT JOIN LATERAL (
    SELECT count(*) AS att_n FROM class_attendance a WHERE a.lesson_log_id = l.id
) a ON TRUE
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

-- ── Bước 2: chuyển điểm danh từ bản bị loại sang bản giữ ─────────────────────────────────
-- class_attendance có PRIMARY KEY (lesson_log_id, student_id), nên mỗi (bản giữ, học viên) chỉ được
-- nhận ĐÚNG MỘT dòng. DISTINCT ON là phần sửa lỗi cốt lõi: bản cũ dùng một UPDATE với NOT EXISTS,
-- mà mọi dòng trong cùng một câu lệnh đều thấy CÙNG một ảnh chụp — nên khi một nhóm có từ 3 bản trở
-- lên và cùng một học viên được đánh dấu ở HAI bản thua nhưng không có ở bản giữ, cả hai dòng đều
-- qua được NOT EXISTS và cùng chuyển về bản giữ → vi phạm khoá chính, migration/script abort.
-- Chỉ chuyển một dòng; các dòng thừa nằm lại ở bản thua và biến mất theo ON DELETE CASCADE ở bước 3.
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

-- ── Bước 3: xoá bản bị loại (điểm danh còn sót đi theo ON DELETE CASCADE của V208) ────────
DELETE FROM class_lesson_logs l
USING dedupe_plan p
WHERE l.id = p.id AND p.id <> p.keep_id;

DROP TABLE dedupe_plan;

-- ── Bước 4: khoá ở tầng DB ───────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_class_lesson_logs_session
    ON class_lesson_logs(class_id, session_date, session_number)
    WHERE session_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_class_lesson_logs_date
    ON class_lesson_logs(class_id, session_date)
    WHERE session_number IS NULL;

COMMENT ON INDEX uq_class_lesson_logs_session IS
    'Chống ghi trùng nhật ký buổi dạy khi có đánh số buổi. Số buổi là căn cứ tính công giáo viên nên ràng buộc phải ở tầng DB, không chỉ ở service.';
COMMENT ON INDEX uq_class_lesson_logs_date IS
    'Bổ trợ cho uq_class_lesson_logs_session: phủ trường hợp session_number NULL, vì UNIQUE index của Postgres coi mọi NULL là khác nhau.';
