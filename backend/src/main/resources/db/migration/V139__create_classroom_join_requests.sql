CREATE TABLE classroom_join_requests (
    id BIGSERIAL PRIMARY KEY,
    classroom_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    status VARCHAR(255) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_classroom_join_requests_classroom_id ON classroom_join_requests(classroom_id);
CREATE INDEX idx_classroom_join_requests_student_id ON classroom_join_requests(student_id);
