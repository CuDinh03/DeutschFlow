-- ============================================================
-- V254: lesson_material — gắn tài liệu vào bài học (M:N) (Phase 1d-D2)
-- ============================================================
-- Một tài liệu (materials) có thể tái sử dụng cho nhiều lớp/bài học, nên dùng bảng NỐI M:N
-- (giống class_materials) thay vì cột lesson_id đơn trên materials (sẽ khoá tài liệu vào 1 bài).
-- order_index cho phép sắp thứ tự tài liệu trong một bài.
--
-- CASCADE: đây là các dòng NỐI (không phải bản thân tài liệu) — xoá bài học hoặc xoá tài liệu
-- chỉ gỡ liên kết. Bản thân materials vẫn còn (được quản lý riêng qua status ACTIVE/ARCHIVED).
-- ============================================================

CREATE TABLE IF NOT EXISTS lesson_material (
    lesson_id   BIGINT NOT NULL,
    material_id BIGINT NOT NULL,
    order_index INT NOT NULL DEFAULT 0,
    attached_by BIGINT NOT NULL,
    attached_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (lesson_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_material_lesson
    ON lesson_material(lesson_id, order_index);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_lesson_material_lesson') THEN
    ALTER TABLE lesson_material
      ADD CONSTRAINT fk_lesson_material_lesson
      FOREIGN KEY (lesson_id) REFERENCES class_lessons(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_lesson_material_material') THEN
    ALTER TABLE lesson_material
      ADD CONSTRAINT fk_lesson_material_material
      FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE;
  END IF;
END $$;
