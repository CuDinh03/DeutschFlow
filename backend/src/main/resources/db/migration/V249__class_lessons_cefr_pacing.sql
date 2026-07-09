-- ============================================================
-- V249: class_lessons — CEFR level + pacing metadata (Phase 1a)
-- ============================================================
-- Thêm 3 cột NULLABLE (additive, backward-compatible, KHÔNG di trú dữ liệu):
--   cefr_level       — cấp CEFR của bài (A1..C2). NULL = chưa gán.
--   planned_date     — ngày dự kiến dạy bài. Đối chiếu với is_completed/completed_at
--                      để tính nhịp độ (đúng tiến độ / chậm / vượt) trên dashboard.
--   estimated_units  — số tiết 45' dự kiến cho bài (dùng ước lượng khối lượng khóa học).
--
-- CHECK constraint gắn ngay từ đầu để KHÔNG lặp lại lỗi "enum không ràng buộc" như
-- class_attendance.status (giá trị lạ lọt xuống DB): cefr_level chỉ nhận đúng 6 giá trị,
-- estimated_units phải dương. Cả hai bỏ qua khi giá trị NULL (bài chưa gán).
--
-- Tương thích ngược: ClassLessonDto dùng chung teacher + student; client TS bỏ qua field
-- JSON thừa nên view học viên không vỡ. Không cần backfill.
-- ============================================================

ALTER TABLE class_lessons
    ADD COLUMN IF NOT EXISTS cefr_level      VARCHAR(8),
    ADD COLUMN IF NOT EXISTS planned_date    DATE,
    ADD COLUMN IF NOT EXISTS estimated_units INT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_class_lessons_cefr_level') THEN
    ALTER TABLE class_lessons
      ADD CONSTRAINT chk_class_lessons_cefr_level
      CHECK (cefr_level IS NULL OR cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_class_lessons_estimated_units') THEN
    ALTER TABLE class_lessons
      ADD CONSTRAINT chk_class_lessons_estimated_units
      CHECK (estimated_units IS NULL OR estimated_units > 0);
  END IF;
END $$;

-- Truy vấn pacing lọc theo lớp + ngày dự kiến (bài quá hạn chưa dạy).
CREATE INDEX IF NOT EXISTS idx_class_lessons_class_planned
    ON class_lessons(class_id, planned_date);
