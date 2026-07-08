-- ============================================================
-- V251: curriculum_module — nhóm bài học thành Module/Teilband (Phase 1c)
-- ============================================================
-- Thêm lớp "Module" (nhóm) phủ lên danh sách bài học phẳng của một lớp: mỗi lớp có
-- các module có thứ tự (order_index), mỗi bài học (class_lessons) tùy chọn thuộc một
-- module qua module_id. Bài chưa gán (module_id NULL) hiển thị ở nhóm "chưa phân nhóm".
--
-- Additive, backward-compatible:
--   - curriculum_module là bảng mới; xoá lớp → CASCADE xoá module của lớp.
--   - class_lessons.module_id NULLABLE FK → ON DELETE SET NULL: xoá module chỉ GỠ NHÓM
--     các bài (không xoá bài). Bài cũ mặc định NULL (chưa phân nhóm) → không vỡ gì.
-- ============================================================

CREATE TABLE IF NOT EXISTS curriculum_module (
    id BIGSERIAL PRIMARY KEY,
    class_id BIGINT NOT NULL,
    order_index INT NOT NULL,
    title VARCHAR(500) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_curriculum_module_class_order
    ON curriculum_module(class_id, order_index);

ALTER TABLE class_lessons
    ADD COLUMN IF NOT EXISTS module_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_class_lessons_module
    ON class_lessons(module_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_curriculum_module_class') THEN
    ALTER TABLE curriculum_module
      ADD CONSTRAINT fk_curriculum_module_class
      FOREIGN KEY (class_id) REFERENCES teacher_classes(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_class_lessons_module') THEN
    ALTER TABLE class_lessons
      ADD CONSTRAINT fk_class_lessons_module
      FOREIGN KEY (module_id) REFERENCES curriculum_module(id) ON DELETE SET NULL;
  END IF;
END $$;
