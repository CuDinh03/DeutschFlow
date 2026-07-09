-- ============================================================
-- V252: class_lesson_logs.lesson_id — nối nhật ký giảng dạy với bài đã dạy (Phase 1d-D3)
-- ============================================================
-- Nhật ký giảng dạy (class_lesson_logs) trước đây chỉ neo vào lớp + free-text `topic`.
-- Thêm FK tuỳ chọn tới bài học chuẩn (class_lessons) để một buổi ghi nhật ký gắn được
-- với đúng Lektion đã dạy.
--
-- Additive, backward-compatible:
--   - lesson_id NULLABLE: các bản ghi cũ (chỉ có topic tự do) vẫn hợp lệ, giữ NULL.
--   - ON DELETE SET NULL: xoá một bài học KHÔNG xoá nhật ký lịch sử — chỉ gỡ liên kết
--     (giống class_lessons.module_id ở V251).
-- ============================================================

ALTER TABLE class_lesson_logs
    ADD COLUMN IF NOT EXISTS lesson_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_class_lesson_logs_lesson
    ON class_lesson_logs(lesson_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_class_lesson_logs_lesson') THEN
    ALTER TABLE class_lesson_logs
      ADD CONSTRAINT fk_class_lesson_logs_lesson
      FOREIGN KEY (lesson_id) REFERENCES class_lessons(id) ON DELETE SET NULL;
  END IF;
END $$;
