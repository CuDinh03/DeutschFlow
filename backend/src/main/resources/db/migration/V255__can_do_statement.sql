-- ============================================================
-- V255: can_do_statement — Kann-Beschreibung / "Ich kann …" của bài học (Phase 1e-B1)
-- ============================================================
-- Mỗi bài học (class_lessons) có thể liệt kê các mục tiêu năng lực kiểu Goethe/GER
-- ("Ich kann ein Gespräch über … führen"). Neo vào BÀI HỌC (không phải module — module_id
-- nullable nên bài chưa phân nhóm sẽ mất can-do; không phải lớp — quá thô). Tái dùng đúng
-- enum 4 kỹ năng (skill_tag) + CEFR như lesson_knowledge_point.
--
-- Net-new (không backfill). ON DELETE CASCADE: xoá bài → xoá can-do của bài (giống điểm kiến thức).
-- Can-do KHÔNG ghi vào class_lessons.description (tránh làm hỏng vòng lặp knowledge-point +
-- đổ raw "Ich kann …" vào thân bài trên mobile) — chỉ phơi qua DTO.
-- ============================================================

CREATE TABLE IF NOT EXISTS can_do_statement (
    id BIGSERIAL PRIMARY KEY,
    lesson_id BIGINT NOT NULL,
    order_index INT NOT NULL,
    cefr_level VARCHAR(8),
    skill_tag VARCHAR(16),
    text TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_can_do_statement_lesson
    ON can_do_statement(lesson_id, order_index);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cds_lesson') THEN
    ALTER TABLE can_do_statement
      ADD CONSTRAINT fk_cds_lesson
      FOREIGN KEY (lesson_id) REFERENCES class_lessons(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cds_cefr_level') THEN
    ALTER TABLE can_do_statement
      ADD CONSTRAINT chk_cds_cefr_level
      CHECK (cefr_level IS NULL OR cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cds_skill_tag') THEN
    ALTER TABLE can_do_statement
      ADD CONSTRAINT chk_cds_skill_tag
      CHECK (skill_tag IS NULL OR skill_tag IN ('HOEREN', 'LESEN', 'SCHREIBEN', 'SPRECHEN'));
  END IF;
END $$;
