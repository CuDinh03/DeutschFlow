-- V134: Teacher LMS V2 Schema Updates

-- 1. Thêm bảng class_teachers để hỗ trợ Multi-teacher (Giáo viên chính / Trợ giảng)
CREATE TABLE class_teachers (
    class_id BIGINT NOT NULL,
    teacher_id BIGINT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'PRIMARY', -- 'PRIMARY', 'ASSISTANT'
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (class_id, teacher_id)
);

CREATE INDEX idx_class_teachers_teacher_id ON class_teachers(teacher_id);

-- Migration data cũ: Copy dữ liệu từ teacher_classes sang class_teachers
INSERT INTO class_teachers (class_id, teacher_id, role, joined_at)
SELECT id, teacher_id, 'PRIMARY', created_at FROM teacher_classes;

-- Ghi chú: Ta giữ cột teacher_id trong teacher_classes để đảm bảo backward compatibility 
-- hoặc như là 'owner' của lớp học.

-- 2. Thêm cột phục vụ AI chấm điểm vào bảng ai_speaking_sessions
ALTER TABLE ai_speaking_sessions ADD COLUMN ai_score INT;
ALTER TABLE ai_speaking_sessions ADD COLUMN ai_feedback TEXT;
ALTER TABLE ai_speaking_sessions ADD COLUMN teacher_score INT;
ALTER TABLE ai_speaking_sessions ADD COLUMN teacher_feedback TEXT;
ALTER TABLE ai_speaking_sessions ADD COLUMN reviewed_at TIMESTAMP;

-- 3. Cập nhật bảng class_assignments (đã có due_date từ V133)
ALTER TABLE class_assignments ADD COLUMN assignment_type VARCHAR(50) DEFAULT 'GENERAL'; -- GENERAL, VOCABULARY, SPEAKING_SCENARIO
ALTER TABLE class_assignments ADD COLUMN reference_id BIGINT;

-- 4. Bảng student_assignments quản lý trạng thái nộp bài
CREATE TABLE student_assignments (
    id BIGSERIAL PRIMARY KEY,
    assignment_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, SUBMITTED, GRADED
    score INT,
    feedback TEXT,
    submitted_at TIMESTAMP,
    graded_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sa_assignment FOREIGN KEY (assignment_id) REFERENCES class_assignments(id) ON DELETE CASCADE
);

CREATE INDEX idx_student_assignments_student_id ON student_assignments(student_id);
CREATE INDEX idx_student_assignments_assignment_id ON student_assignments(assignment_id);
