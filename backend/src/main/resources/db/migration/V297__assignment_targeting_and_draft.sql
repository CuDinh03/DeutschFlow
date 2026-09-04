-- ============================================================================
-- V297 — GĐ4 PR-8 (spec §6/§8, P06, AC14): học liệu/bài tập NHÁP→CÔNG BỐ và giao
-- bài theo NGƯỜI NHẬN.
--
-- 1) class_assignments: + status DRAFT|PUBLISHED (dữ liệu cũ = PUBLISHED — hành vi
--    trước giờ là công bố ngay), + published_at (backfill = created_at cho bài cũ),
--    + session_id/lektion_id/curriculum_item_id — bài gắn NỘI DUNG và BUỔI, không
--    chỉ ngày (spec §8).
-- 2) class_assignment_recipients: KHÔNG có dòng = giao CẢ LỚP (tương thích cũ);
--    có dòng = chỉ người được chọn nhận bài + notification (AC14).
-- ============================================================================

ALTER TABLE class_assignments
    ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'PUBLISHED',
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS session_id BIGINT REFERENCES class_sessions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS lektion_id BIGINT REFERENCES curriculum_lektionen(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS curriculum_item_id BIGINT REFERENCES curriculum_items(id) ON DELETE SET NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ca_status') THEN
        ALTER TABLE class_assignments ADD CONSTRAINT chk_ca_status CHECK
            (status IN ('DRAFT','PUBLISHED'));
    END IF;
END $$;

-- Bài cũ đều đã tới tay học viên từ lúc tạo → mốc công bố chính là created_at.
UPDATE class_assignments SET published_at = created_at WHERE published_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ca_session ON class_assignments(session_id) WHERE session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS class_assignment_recipients (
    assignment_id BIGINT NOT NULL REFERENCES class_assignments(id) ON DELETE CASCADE,
    student_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at    TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_car_student ON class_assignment_recipients(student_id);
