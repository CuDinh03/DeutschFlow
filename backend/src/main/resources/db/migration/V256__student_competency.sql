-- ============================================================
-- V256: student_competency — sổ năng lực HV × can-do (Phase 2a, ledger + Selbstevaluation B3)
-- ============================================================
-- Mỗi học viên × mỗi Kann-Beschreibung (can_do_statement) → trạng thái đạt được.
-- Phase 2a chỉ ghi từ HV tự đánh giá (source=SELF); B4 sau này auto-cập nhật từ chấm điểm
-- (source=GRADING) và SRS (source=SRS) trên CÙNG bảng này.
--
-- status: NOT_STARTED (mặc định / chưa có dòng) | IN_PROGRESS | MASTERED.
-- UNIQUE(student_id, can_do_statement_id): 1 dòng / cặp; upsert khi HV đổi tự đánh giá.
-- CASCADE: xoá can-do (hoặc user) → xoá dòng năng lực tương ứng.
-- ============================================================

CREATE TABLE IF NOT EXISTS student_competency (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL,
    can_do_statement_id BIGINT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'NOT_STARTED',
    source VARCHAR(16) NOT NULL DEFAULT 'SELF',
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, can_do_statement_id)
);

CREATE INDEX IF NOT EXISTS idx_student_competency_student
    ON student_competency(student_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_student_competency_cando') THEN
    ALTER TABLE student_competency
      ADD CONSTRAINT fk_student_competency_cando
      FOREIGN KEY (can_do_statement_id) REFERENCES can_do_statement(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_student_competency_student') THEN
    ALTER TABLE student_competency
      ADD CONSTRAINT fk_student_competency_student
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_student_competency_status') THEN
    ALTER TABLE student_competency
      ADD CONSTRAINT chk_student_competency_status
      CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'MASTERED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_student_competency_source') THEN
    ALTER TABLE student_competency
      ADD CONSTRAINT chk_student_competency_source
      CHECK (source IN ('SELF', 'GRADING', 'SRS'));
  END IF;
END $$;
