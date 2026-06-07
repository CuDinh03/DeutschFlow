-- ============================================================
-- V197: class_lessons — teacher-managed lesson checklist per class
-- ============================================================
-- Each class has an ordered list of lessons (buổi học). Teachers tick a lesson
-- when they finish covering it, which becomes the class's authoritative progress
-- signal for students. Students read this list as read-only.
-- ============================================================

CREATE TABLE IF NOT EXISTS class_lessons (
    id BIGSERIAL PRIMARY KEY,
    class_id BIGINT NOT NULL,
    order_index INT NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMP,
    completed_by_teacher_id BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_class_lessons_class_order
    ON class_lessons(class_id, order_index);

CREATE INDEX IF NOT EXISTS idx_class_lessons_class_completed
    ON class_lessons(class_id, is_completed);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_class_lessons_class') THEN
    ALTER TABLE class_lessons
      ADD CONSTRAINT fk_class_lessons_class
      FOREIGN KEY (class_id) REFERENCES teacher_classes(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_class_lessons_completed_by') THEN
    ALTER TABLE class_lessons
      ADD CONSTRAINT fk_class_lessons_completed_by
      FOREIGN KEY (completed_by_teacher_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
