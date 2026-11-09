-- Phiên hỗ trợ CHỈ-ĐỌC (owner chốt 09/11/2026): ADMIN xem ứng dụng dưới góc nhìn một người dùng (không phải
-- ADMIN) tối đa 30 phút, có lý do bắt buộc, người dùng được báo (thông báo + Hoạt động bảo mật). Không ghi thay
-- người dùng — mọi method ghi bị chặn ở SupportSessionReadOnlyFilter, connection DB của request hỗ trợ bị đặt
-- READ ONLY, và mọi đường gọi AI bị chặn.
--
-- Bảng:
--   admin_support_sessions        — một dòng/phiên. ended_at NULL + expires_at > now() = đang mở. Mã bàn giao
--                                   (handoff) để tab mới đổi lấy token typ=support: chỉ lưu SHA-256 (hex), sống
--                                   60 s, dùng một lần (handoff_used_at).
--   admin_support_session_events  — mỗi request của phiên (method, đường dẫn KHÔNG kèm query string, status) —
--                                   nhật ký "admin đã xem gì" cho điều tra sau này.
--
-- TƯƠNG THÍCH NGƯỢC (QUY_TRINH_PHAT_HANH §6.2): chỉ THÊM bảng. Màu cũ không đọc/ghi các bảng này; token
-- typ=support bị màu cũ từ chối (401) vì cờ app.security.support-session.enabled mặc định false ở bản đó.

CREATE TABLE admin_support_sessions (
    id                 BIGSERIAL    PRIMARY KEY,
    admin_user_id      BIGINT       NOT NULL REFERENCES users (id),
    target_user_id     BIGINT       NOT NULL REFERENCES users (id),
    reason             TEXT         NOT NULL,
    started_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at         TIMESTAMPTZ  NOT NULL,
    ended_at           TIMESTAMPTZ  NULL,
    -- admin_ended | user_view_ended | replaced | expired | admin_logout | admin_role_changed |
    -- admin_deactivated | admin_mfa_reset | target_deactivated | target_role_changed
    end_reason         VARCHAR(32)  NULL,
    handoff_code_hash  VARCHAR(128) NULL,
    handoff_expires_at TIMESTAMPTZ  NULL,
    handoff_used_at    TIMESTAMPTZ  NULL
);

-- Phiên đang mở của một admin (một admin chỉ có một phiên mở) + quét hết hạn.
CREATE INDEX idx_admin_support_sessions_active_admin
    ON admin_support_sessions (admin_user_id, expires_at)
    WHERE ended_at IS NULL;

-- Danh sách phiên theo người dùng đích (tab hồ sơ người dùng của admin).
CREATE INDEX idx_admin_support_sessions_target
    ON admin_support_sessions (target_user_id, started_at DESC);

-- Trần 20 phiên/admin/ngày đếm theo started_at.
CREATE INDEX idx_admin_support_sessions_admin_started
    ON admin_support_sessions (admin_user_id, started_at DESC);

-- Tra mã bàn giao khi redeem.
CREATE UNIQUE INDEX uq_admin_support_sessions_handoff
    ON admin_support_sessions (handoff_code_hash)
    WHERE handoff_code_hash IS NOT NULL;

CREATE TABLE admin_support_session_events (
    id         BIGSERIAL    PRIMARY KEY,
    session_id BIGINT       NOT NULL REFERENCES admin_support_sessions (id) ON DELETE CASCADE,
    method     VARCHAR(8)   NOT NULL,
    path       VARCHAR(300) NOT NULL,
    status     INT          NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_support_session_events_session
    ON admin_support_session_events (session_id, created_at);
