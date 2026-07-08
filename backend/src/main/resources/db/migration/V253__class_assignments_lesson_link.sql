-- ============================================================
-- V253: class_assignments.lesson_id — nối bài tập/giao bài với bài học (Phase 1d-D1)
-- ============================================================
-- Một bài tập (class_assignments = TEMPLATE do GV tạo cho lớp) có thể tuỳ chọn thuộc về
-- một bài học chuẩn (class_lessons). Cột đặt trên TEMPLATE, KHÔNG phải student_assignments
-- (per-student) để tránh nhân bản/lệch dữ liệu khi fan-out.
--
-- Additive, backward-compatible:
--   - lesson_id NULLABLE: bài tập cũ (không gắn bài) vẫn hợp lệ, giữ NULL.
--   - ON DELETE SET NULL: xoá một bài học KHÔNG xoá bài tập/điểm của học viên — chỉ gỡ liên kết.
-- ============================================================

ALTER TABLE class_assignments
    ADD COLUMN IF NOT EXISTS lesson_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_class_assignments_lesson
    ON class_assignments(lesson_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_class_assignments_lesson') THEN
    ALTER TABLE class_assignments
      ADD CONSTRAINT fk_class_assignments_lesson
      FOREIGN KEY (lesson_id) REFERENCES class_lessons(id) ON DELETE SET NULL;
  END IF;
END $$;
