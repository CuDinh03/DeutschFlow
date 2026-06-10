-- Phase 3: Teacher evaluation & comments per student per class

ALTER TABLE class_students
    ADD COLUMN IF NOT EXISTS teacher_comment TEXT,
    ADD COLUMN IF NOT EXISTS skill_horen     NUMERIC(4,1),
    ADD COLUMN IF NOT EXISTS skill_lesen     NUMERIC(4,1),
    ADD COLUMN IF NOT EXISTS skill_schreiben NUMERIC(4,1),
    ADD COLUMN IF NOT EXISTS skill_sprechen  NUMERIC(4,1),
    ADD COLUMN IF NOT EXISTS evaluated_at    TIMESTAMPTZ;

COMMENT ON COLUMN class_students.teacher_comment  IS 'Free-text nhận xét của giáo viên';
COMMENT ON COLUMN class_students.skill_horen      IS 'Điểm kỹ năng Nghe (0–10)';
COMMENT ON COLUMN class_students.skill_lesen      IS 'Điểm kỹ năng Đọc (0–10)';
COMMENT ON COLUMN class_students.skill_schreiben  IS 'Điểm kỹ năng Viết (0–10)';
COMMENT ON COLUMN class_students.skill_sprechen   IS 'Điểm kỹ năng Nói (0–10)';
