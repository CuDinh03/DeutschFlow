-- Phase 2: Lesson log (nhật ký giảng dạy) + attendance (điểm danh)

CREATE TABLE IF NOT EXISTS class_lesson_logs (
    id          BIGSERIAL PRIMARY KEY,
    class_id    BIGINT NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    session_number INT,
    topic       TEXT,
    homework    TEXT,
    note        TEXT,
    created_by  BIGINT REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_class_lesson_logs_class_id ON class_lesson_logs(class_id);
CREATE INDEX IF NOT EXISTS idx_class_lesson_logs_date     ON class_lesson_logs(class_id, session_date);

CREATE TABLE IF NOT EXISTS class_attendance (
    lesson_log_id BIGINT NOT NULL REFERENCES class_lesson_logs(id) ON DELETE CASCADE,
    student_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status        VARCHAR(10) NOT NULL DEFAULT 'PRESENT',  -- PRESENT | ABSENT | LATE
    note          TEXT,
    PRIMARY KEY (lesson_log_id, student_id)
);

COMMENT ON COLUMN class_attendance.status IS 'PRESENT = có mặt, ABSENT = vắng, LATE = muộn';
