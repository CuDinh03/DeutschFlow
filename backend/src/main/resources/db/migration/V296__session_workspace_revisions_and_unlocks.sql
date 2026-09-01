-- ============================================================================
-- V296 — GĐ4 PR-7 (spec §8/§2.3, P07, AC13): màn làm việc theo buổi.
--
-- 1) class_record_revisions — LỊCH SỬ mọi lần sửa/xoá bản ghi giảng dạy hồi tố
--    (nhật ký, điểm danh, xác nhận nội dung): before/after jsonb + lý do. P07:
--    sửa trong CỬA SỔ 7 NGÀY sau buổi là quyền giáo viên (vẫn ghi lịch sử);
--    quá hạn phải có mở khóa của người duyệt học vụ.
-- 2) class_record_unlocks — mở khóa 24h có audit (người cấp/lý do/hết hạn).
-- 3) class_attendance.needs_makeup — AC13: học viên VẮNG mang cờ "cần bù riêng";
--    lớp giữ tiến độ chung, không ai bị chặn theo.
-- ============================================================================

CREATE TABLE IF NOT EXISTS class_record_revisions (
    id           BIGSERIAL PRIMARY KEY,
    entity_type  VARCHAR(32) NOT NULL,
    entity_id    BIGINT NOT NULL,
    class_id     BIGINT NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
    session_id   BIGINT REFERENCES class_sessions(id) ON DELETE SET NULL,
    changed_by   BIGINT NOT NULL REFERENCES users(id),
    changed_at   TIMESTAMP NOT NULL DEFAULT now(),
    reason       TEXT,
    -- Bản chụp TRƯỚC/SAU thay đổi (null before = tạo mới; null after = xoá).
    before_state JSONB,
    after_state  JSONB
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_crr_entity_type') THEN
        ALTER TABLE class_record_revisions ADD CONSTRAINT chk_crr_entity_type CHECK
            (entity_type IN ('LESSON_LOG','SESSION_CONTENT','SESSION_COMPLETION'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crr_class_time ON class_record_revisions(class_id, changed_at);
CREATE INDEX IF NOT EXISTS idx_crr_entity ON class_record_revisions(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS class_record_unlocks (
    id          BIGSERIAL PRIMARY KEY,
    class_id    BIGINT NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
    -- null = mở khóa mọi buổi của lớp trong 24h; khác null = chỉ buổi đó.
    session_id  BIGINT REFERENCES class_sessions(id) ON DELETE CASCADE,
    granted_to  BIGINT NOT NULL REFERENCES users(id),
    granted_by  BIGINT NOT NULL REFERENCES users(id),
    reason      TEXT NOT NULL,
    granted_at  TIMESTAMP NOT NULL DEFAULT now(),
    expires_at  TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cru_active
    ON class_record_unlocks(class_id, granted_to, expires_at);

-- AC13: vắng → cờ "cần bù riêng" (giáo viên bỏ/đặt lại được), KHÔNG chặn tiến độ lớp.
ALTER TABLE class_attendance
    ADD COLUMN IF NOT EXISTS needs_makeup BOOLEAN NOT NULL DEFAULT FALSE;
