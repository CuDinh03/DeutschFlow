-- ============================================================================
-- V298 — GĐ5 PR-9 (spec §7, AC12/AC15, P04-nền): đánh giá HỌC VIÊN theo MỤC TIÊU
-- giáo trình + kho cấu hình trung tâm.
--
-- 1) student_objective_assessments: đánh giá 3 trạng thái theo curriculum_objectives.
--    Đánh giá lại KHÔNG xoá bản cũ — bản mới supersede bản trước (lịch sử giữ
--    nguyên); partial UNIQUE đảm bảo mỗi (lớp, học viên, mục tiêu) chỉ MỘT bản
--    đang hiệu lực. AC12: bài đã nộp chưa chấm là "chờ chấm" — không được đọc
--    thành NEEDS_PRACTICE.
-- 2) org_settings: key-value theo trung tâm — PR-9 dùng ngưỡng gợi ý hỗ trợ
--    (support_individual_max=2 / review_group_min=3), PR-10 thêm chính sách tính
--    công P04 (timesheet_break_included, default true).
-- ============================================================================

CREATE TABLE IF NOT EXISTS student_objective_assessments (
    id             BIGSERIAL PRIMARY KEY,
    class_id       BIGINT NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
    student_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    objective_id   BIGINT NOT NULL REFERENCES curriculum_objectives(id) ON DELETE RESTRICT,
    status         VARCHAR(20) NOT NULL,
    evidence       TEXT,
    assessed_by    BIGINT NOT NULL REFERENCES users(id),
    assessed_at    TIMESTAMP NOT NULL DEFAULT now(),
    -- Bản này thay cho bản nào (lịch sử); bản bị thay mang superseded=true.
    supersedes_id  BIGINT REFERENCES student_objective_assessments(id) ON DELETE SET NULL,
    superseded     BOOLEAN NOT NULL DEFAULT FALSE
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_soa_status') THEN
        ALTER TABLE student_objective_assessments ADD CONSTRAINT chk_soa_status CHECK
            (status IN ('NOT_ASSESSED','NEEDS_PRACTICE','ACHIEVED'));
    END IF;
END $$;

-- Mỗi (lớp, học viên, mục tiêu) đúng MỘT bản đánh giá đang hiệu lực.
CREATE UNIQUE INDEX IF NOT EXISTS uq_soa_current
    ON student_objective_assessments(class_id, student_id, objective_id)
    WHERE superseded = FALSE;

CREATE INDEX IF NOT EXISTS idx_soa_class ON student_objective_assessments(class_id);

CREATE TABLE IF NOT EXISTS org_settings (
    org_id      BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    setting_key VARCHAR(64) NOT NULL,
    value       VARCHAR(255) NOT NULL,
    updated_by  BIGINT REFERENCES users(id),
    updated_at  TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (org_id, setting_key)
);
