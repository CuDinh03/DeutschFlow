-- ============================================================
-- V265: toàn vẹn dữ liệu cụm chấm công (Đợt 2 của kế hoạch)
-- ============================================================
-- Hai việc, độc lập nhau:
--   (1) Gỡ FK đang CHẶN CỨNG việc xoá tài khoản giáo viên.
--   (2) Ràng buộc enum trạng thái điểm danh ở tầng DB.
--
-- KHÔNG bao gồm unique index chống nhật ký trùng buổi: index đó sẽ THẤT BẠI nếu prod đã có dữ
-- liệu trùng sẵn, và migration hỏng thì chặn cả lần deploy. Việc chặn ghi trùng MỚI đã được làm ở
-- tầng service (LessonLogService.assertRecordableSession). Index chỉ nên thêm sau khi đã chạy truy
-- vấn khảo sát và dọn dữ liệu trùng — xem §5 của plans/2026-07-20-nang-cap-cham-cong-giao-vien.md.
-- ============================================================

-- ------------------------------------------------------------
-- (1) class_lesson_logs.created_by: RESTRICT → SET NULL
-- ------------------------------------------------------------
-- V208 khai `created_by BIGINT REFERENCES users(id)` mà không nêu ON DELETE, nên Postgres mặc định
-- NO ACTION (tương đương RESTRICT). Hệ quả: một giáo viên đã từng ghi nhật ký buổi dạy thì
-- `DELETE FROM users` vướng FK → AccountDeletionService rollback → NGƯỜI DÙNG KHÔNG XOÁ ĐƯỢC TÀI
-- KHOẢN. Đây là rủi ro tuân thủ App Store 5.1.1(v), không chỉ là phiền toái kỹ thuật.
--
-- SET NULL là lựa chọn đúng thay vì CASCADE: nhật ký buổi dạy là dữ liệu học vụ của LỚP, không phải
-- dữ liệu cá nhân của người nhập. Xoá tài khoản giáo viên không được làm bốc hơi lịch sử giảng dạy
-- và điểm danh của học viên. Cột vốn đã NULLABLE nên không cần đổi kiểu.
-- Cùng nguyên tắc với class_lesson_logs.lesson_id ở V252.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_lesson_logs_created_by_fkey') THEN
    ALTER TABLE class_lesson_logs DROP CONSTRAINT class_lesson_logs_created_by_fkey;
  END IF;
END $$;

ALTER TABLE class_lesson_logs
    ADD CONSTRAINT class_lesson_logs_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN class_lesson_logs.created_by IS
    'Người GHI nhật ký (không phải người dạy — xem teacher_session_record cho việc tính công). ON DELETE SET NULL: xoá tài khoản không được xoá lịch sử giảng dạy của lớp.';

-- ------------------------------------------------------------
-- (2) class_attendance.status: ràng buộc enum ở tầng DB
-- ------------------------------------------------------------
-- V208 để status là VARCHAR(10) NOT NULL DEFAULT 'PRESENT' mà không có CHECK. Hiện chỉ
-- LessonLogService.buildAttendance chặn giá trị lạ; mọi writer tương lai (script backfill, endpoint
-- mới) đều ghi được 'present' viết thường hay 'EXCUSED'. Báo cáo chuyên cần so khớp chuỗi HOA nên
-- những hàng đó bị phân loại sai và làm lệch tỉ lệ — nay số liệu này còn liên quan tới chứng chỉ.
--
-- Dùng NOT VALID có chủ ý: ràng buộc áp ngay cho hàng MỚI và hàng được cập nhật, nhưng KHÔNG quét
-- lại toàn bộ dữ liệu cũ. Nếu prod lỡ có hàng lệch chuẩn thì migration vẫn chạy được thay vì chặn
-- deploy. Sau khi khảo sát và dọn, chạy tay:
--     ALTER TABLE class_attendance VALIDATE CONSTRAINT chk_class_attendance_status;
-- Truy vấn khảo sát:
--     SELECT status, count(*) FROM class_attendance
--     WHERE status NOT IN ('PRESENT','LATE','ABSENT') GROUP BY status;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_class_attendance_status') THEN
    ALTER TABLE class_attendance
      ADD CONSTRAINT chk_class_attendance_status
      CHECK (status IN ('PRESENT', 'LATE', 'ABSENT')) NOT VALID;
  END IF;
END $$;
