-- ============================================================================
-- V295 — GĐ3 PR-6 (spec §4/P05, AC09): MỐC của lớp trung tâm — ngày thi chính thức
-- và ngày kết thúc khóa dự kiến.
--
-- P05: chỉ mốc CHÍNH THỨC mới cần duyệt khi DỜI — lớp đã gắn giáo trình đổi
-- planned_date đi qua class_schedule_change_requests (type MOVE_MILESTONE, V294);
-- tạo/xoá và sửa mô tả là thao tác trực tiếp của giáo viên. Dự báo (AC09) đối
-- chiếu planned_date với ngày-hoàn-thành-dự-kiến từ phân bổ để cảnh báo mốc rủi
-- ro — hệ thống KHÔNG tự dời mốc.
-- ============================================================================

CREATE TABLE IF NOT EXISTS class_milestones (
    id            BIGSERIAL PRIMARY KEY,
    class_id      BIGINT NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
    kind          VARCHAR(16) NOT NULL,
    title         VARCHAR(255) NOT NULL,
    planned_date  DATE NOT NULL,
    note          TEXT,
    created_by    BIGINT NOT NULL REFERENCES users(id),
    created_at    TIMESTAMP NOT NULL DEFAULT now(),
    updated_at    TIMESTAMP NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cm_kind') THEN
        ALTER TABLE class_milestones ADD CONSTRAINT chk_cm_kind CHECK
            (kind IN ('EXAM','COURSE_END'));
    END IF;
END $$;

-- Một lớp chỉ có MỘT mốc kết thúc khóa; mốc thi (EXAM) bao nhiêu cũng được.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cm_course_end
    ON class_milestones(class_id)
    WHERE kind = 'COURSE_END';

CREATE INDEX IF NOT EXISTS idx_cm_class_date
    ON class_milestones(class_id, planned_date);
