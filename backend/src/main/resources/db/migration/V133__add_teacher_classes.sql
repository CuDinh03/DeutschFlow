-- V133: B2B2C Teacher Dashboard Tables

CREATE TABLE teacher_classes (
    id BIGSERIAL PRIMARY KEY,
    teacher_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    invite_code VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP
);

CREATE TABLE class_students (
    class_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    joined_at TIMESTAMP NOT NULL,
    PRIMARY KEY (class_id, student_id)
);

CREATE TABLE class_assignments (
    id BIGSERIAL PRIMARY KEY,
    class_id BIGINT NOT NULL,
    topic VARCHAR(255) NOT NULL,
    description TEXT,
    due_date TIMESTAMP,
    created_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_teacher_classes_teacher_id ON teacher_classes(teacher_id);
CREATE INDEX idx_class_students_student_id ON class_students(student_id);
