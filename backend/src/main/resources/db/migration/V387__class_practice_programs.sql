-- Chương trình luyện của một lớp (đặc tả luyendeu, ORG-50/51/65): ngày bắt đầu (thứ Hai, giờ VN),
-- số tuần, chỉ tiêu phiên/tuần, số tuần đạt yêu cầu. Mỗi lớp tối đa một chương trình.
-- Lớp có chương trình chưa kết thúc ⇒ học viên ACTIVE của lớp chỉ luyện bằng giọng nói (tắt ô gõ).
-- Chỉ thêm bảng: an toàn cho blue-green.
CREATE TABLE class_practice_programs (
    class_id          BIGINT       PRIMARY KEY REFERENCES teacher_classes (id) ON DELETE CASCADE,
    start_date        DATE         NOT NULL,
    weeks             INTEGER      NOT NULL DEFAULT 6,
    target_per_week   INTEGER      NOT NULL DEFAULT 3,
    weeks_required    INTEGER      NOT NULL DEFAULT 4,
    created_by        BIGINT,
    updated_by        BIGINT,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_cpp_start_monday CHECK (EXTRACT(ISODOW FROM start_date) = 1),
    CONSTRAINT ck_cpp_weeks CHECK (weeks BETWEEN 1 AND 12),
    CONSTRAINT ck_cpp_target CHECK (target_per_week BETWEEN 1 AND 14),
    CONSTRAINT ck_cpp_required CHECK (weeks_required BETWEEN 1 AND weeks)
);

-- Tra cờ "chỉ nói" theo học viên: class_students đã có chỉ mục theo student_id; bảng này nhỏ.
