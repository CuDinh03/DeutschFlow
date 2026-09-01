-- ============================================================================
-- V294 — GĐ3 PR-5 (spec 2026-08-31 §4, AC03/04/09–11/17–23): luồng ĐỀ XUẤT → DUYỆT
-- thay đổi lịch cho lớp trung tâm đã gắn giáo trình + hạ tầng thông báo bền vững.
--
-- 1) class_schedule_change_requests — mọi mutation lịch của giáo viên trên lớp
--    org-có-giáo-trình không ghi thẳng nữa: tạo đề xuất PENDING kèm bản chụp tác
--    động; người duyệt học vụ (org_academic_approvers, V291) duyệt/từ chối; đề
--    xuất chạm T7/CN (has_weekend) chỉ OWNER duyệt (AC19/AC20/AC23).
-- 2) teacher_classes.schedule_version — chống duyệt trên nền lỗi thời (AC10):
--    đề xuất lưu base_version lúc tạo; khi áp dụng so khớp + tăng trong CÙNG
--    giao dịch; lệch = lịch đã đổi từ lúc đề xuất → bắt tính lại.
-- 3) notification_outbox — thông báo học viên chỉ được GHI trong giao dịch áp
--    dụng lịch (commit thì mới tồn tại), worker gửi + retry; dedup_key chặn gửi
--    trùng theo (đề xuất, phiên bản, người nhận). Thay cho @Async bắn trong
--    transaction (CallerRunsPolicy có thể chạy cùng thread TRƯỚC commit — G2).
-- ============================================================================

-- 1) Đề xuất thay đổi lịch -----------------------------------------------------
CREATE TABLE IF NOT EXISTS class_schedule_change_requests (
    id               BIGSERIAL PRIMARY KEY,
    class_id         BIGINT NOT NULL REFERENCES teacher_classes(id) ON DELETE CASCADE,
    -- Khai đủ mọi loại ngay từ đầu (bài học V229): MOVE_MILESTONE dùng từ PR-6.
    request_type     VARCHAR(32) NOT NULL,
    -- Nội dung thay đổi theo loại (JSON của request tương ứng đường ghi cũ).
    payload          JSONB NOT NULL,
    -- Bản chụp tác động lúc NỘP (buổi ảnh hưởng, số phần nội dung đã xếp, ngày cuối tuần…)
    -- để người duyệt thấy đúng cái giáo viên thấy; không tính lại lúc đọc.
    impact_snapshot  JSONB,
    reason           TEXT,
    -- Đề xuất chạm T7/CN → chỉ OWNER được duyệt (AC19/AC20/AC23).
    has_weekend      BOOLEAN NOT NULL DEFAULT FALSE,
    -- schedule_version của lớp lúc tạo đề xuất (AC10).
    base_version     BIGINT NOT NULL,
    status           VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    requested_by     BIGINT NOT NULL REFERENCES users(id),
    requested_at     TIMESTAMP NOT NULL DEFAULT now(),
    reviewed_by      BIGINT REFERENCES users(id),
    reviewed_at      TIMESTAMP,
    reject_reason    TEXT,
    -- Thời điểm thay đổi THẬT SỰ được áp vào lịch (cùng giao dịch APPROVED).
    applied_at       TIMESTAMP,
    updated_at       TIMESTAMP NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cscr_type') THEN
        ALTER TABLE class_schedule_change_requests ADD CONSTRAINT chk_cscr_type CHECK
            (request_type IN ('CANCEL_SESSION','ADD_MAKEUP','MOVE_SESSION','UPDATE_PATTERN','MOVE_MILESTONE'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cscr_status') THEN
        ALTER TABLE class_schedule_change_requests ADD CONSTRAINT chk_cscr_status CHECK
            (status IN ('PENDING','APPROVED','REJECTED','CANCELLED'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cscr_class_status
    ON class_schedule_change_requests(class_id, status);
-- Hàng chờ duyệt của org quét theo PENDING — partial cho gọn.
CREATE INDEX IF NOT EXISTS idx_cscr_pending
    ON class_schedule_change_requests(requested_at)
    WHERE status = 'PENDING';

-- 2) Phiên bản lịch của lớp (AC10) --------------------------------------------
ALTER TABLE teacher_classes
    ADD COLUMN IF NOT EXISTS schedule_version BIGINT NOT NULL DEFAULT 0;

-- 3) Outbox thông báo bền vững -------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_outbox (
    id                BIGSERIAL PRIMARY KEY,
    -- 'request:{id}:v{version}:u{userId}' — UNIQUE chặn gửi trùng (đề xuất, phiên bản, người nhận).
    dedup_key         VARCHAR(128) NOT NULL,
    notification_type VARCHAR(64) NOT NULL,
    class_id          BIGINT,
    recipient_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
    status            VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    attempts          INT NOT NULL DEFAULT 0,
    next_attempt_at   TIMESTAMP NOT NULL DEFAULT now(),
    last_error        TEXT,
    created_at        TIMESTAMP NOT NULL DEFAULT now(),
    sent_at           TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_outbox_dedup') THEN
        ALTER TABLE notification_outbox ADD CONSTRAINT uq_outbox_dedup UNIQUE (dedup_key);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_outbox_status') THEN
        ALTER TABLE notification_outbox ADD CONSTRAINT chk_outbox_status CHECK
            (status IN ('PENDING','SENT','FAILED'));
    END IF;
END $$;

-- Worker chỉ quét dòng chưa gửi xong, đến hạn — partial index theo đúng truy vấn.
CREATE INDEX IF NOT EXISTS idx_outbox_due
    ON notification_outbox(next_attempt_at)
    WHERE status <> 'SENT';
