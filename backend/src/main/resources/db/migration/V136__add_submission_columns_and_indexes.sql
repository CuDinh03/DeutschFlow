ALTER TABLE student_assignments
ADD COLUMN submission_content TEXT,
ADD COLUMN submission_file_url VARCHAR(1024),
ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_student_assignments_assignment_id ON student_assignments(assignment_id);
CREATE INDEX IF NOT EXISTS idx_student_assignments_student_id ON student_assignments(student_id);

CREATE INDEX IF NOT EXISTS idx_class_assignments_class_id ON class_assignments(class_id);
