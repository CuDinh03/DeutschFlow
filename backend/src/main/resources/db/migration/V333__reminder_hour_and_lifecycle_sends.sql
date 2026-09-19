-- ============================================================
-- V333: Đợt 6 kế hoạch onboarding 17/09/2026 (§4.7) — giờ nhắc theo người dùng + sổ gửi lifecycle
--
-- (1) users.reminder_hour_local — giờ nhắc học (0–23, theo notification_timezone của người dùng).
--     NULL = chưa chọn ⇒ DailyNotificationJob giữ 18h như trước. Mobile ghi 20 khi bật sheet nhắc
--     học (PATCH /profile/me), web ghi từ checklist tuần đầu (W11) hoặc trang Hồ sơ.
-- (2) lifecycle_sends — mỗi (user, message_key) gửi ĐÚNG MỘT LẦN (D0, D1, D3, D7, T3, T0):
--     OnboardingLifecycleService INSERT … ON CONFLICT DO NOTHING rồi mới chèn thông báo; job chạy
--     lại giờ sau không gửi trùng. Ngày có tin lifecycle thì STREAK_REMINDER 18h bị bỏ (luật hợp nhất).
--
-- Ràng buộc thứ tự: V332 (ngân hàng placement) đã áp trên prod 19/09; file này là V333.
-- ============================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS reminder_hour_local INTEGER NULL;  -- INTEGER (không SMALLINT) để khớp Hibernate validate với Integer trên entity

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS chk_users_reminder_hour_local;
ALTER TABLE users
    ADD CONSTRAINT chk_users_reminder_hour_local
        CHECK (reminder_hour_local IS NULL OR (reminder_hour_local BETWEEN 0 AND 23));

CREATE TABLE IF NOT EXISTS lifecycle_sends (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_key VARCHAR(32) NOT NULL,
    sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_lifecycle_sends_user_key UNIQUE (user_id, message_key)
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_sends_user_sent ON lifecycle_sends (user_id, sent_at DESC);

COMMENT ON COLUMN users.reminder_hour_local IS 'Giờ nhắc học 0–23 theo notification_timezone; NULL = mặc định 18h (Đợt 6 onboarding 19/09/2026)';
COMMENT ON TABLE lifecycle_sends IS 'Sổ gửi tin lifecycle tuần đầu/trial — mỗi (user, key) một lần (Đợt 6 onboarding 19/09/2026)';
