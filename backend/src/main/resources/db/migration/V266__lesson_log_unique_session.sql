-- ============================================================
-- V266: chặn nhật ký trùng buổi ở TẦNG DB
-- ============================================================
-- ⚠️ TRƯỚC KHI DEPLOY migration này, phải chạy trên đúng môi trường đích:
--       psql "$DATABASE_URL" -f backend/scripts/survey_timesheet_data_debt.sql
--       psql "$DATABASE_URL" -f backend/scripts/dedupe_class_lesson_logs.sql   # nếu khảo sát ra > 0
--    Còn bản trùng thì CREATE UNIQUE INDEX sẽ thất bại và chặn cả lần deploy.
--
-- VÌ SAO CẦN, dù tầng service đã chặn: LessonLogService.assertRecordableSession chỉ chặn được
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
