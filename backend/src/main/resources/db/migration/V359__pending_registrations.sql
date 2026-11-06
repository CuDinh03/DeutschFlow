-- Hồ sơ đăng ký đang chờ xác nhận mã PIN (plans/2026-11-05-thiet-ke-ma-pin-xac-nhan-dang-ky.md §3).
-- Chưa xác minh thì CHƯA có dòng users nào: hồ sơ chờ không giữ ô UNIQUE nào của users, nên không ai
-- chiếm chỗ được email của người khác.
CREATE TABLE pending_registrations (
    id             BIGSERIAL    PRIMARY KEY,
    email          VARCHAR(255) NOT NULL,              -- đã trim + lower
    phone_number   VARCHAR(15),
    password_hash  VARCHAR(255) NOT NULL,              -- BCrypt, không bao giờ lưu thô
    display_name   VARCHAR(100) NOT NULL,
    locale         VARCHAR(8)   NOT NULL DEFAULT 'vi',
    code_hash      CHAR(64)     NOT NULL,              -- HMAC-SHA256(pepper, id:code), hex
    attempts       SMALLINT     NOT NULL DEFAULT 0,    -- số lần nhập sai cho MÃ HIỆN TẠI
    sends          SMALLINT     NOT NULL DEFAULT 1,    -- số lần đã gửi (start + resend)
    last_sent_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expires_at     TIMESTAMPTZ  NOT NULL,
    closed_at      TIMESTAMPTZ,
    closed_reason  VARCHAR(16),                        -- VERIFIED | LOCKED | SUPERSEDED | SEND_FAILED | EXPIRED
    created_ip     VARCHAR(45),
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_pending_closed CHECK ((closed_at IS NULL) = (closed_reason IS NULL)),
    CONSTRAINT chk_pending_closed_reason CHECK (closed_reason IS NULL OR closed_reason IN
        ('VERIFIED', 'LOCKED', 'SUPERSEDED', 'SEND_FAILED', 'EXPIRED'))
);

-- Mỗi email tối đa MỘT hồ sơ đang mở.
CREATE UNIQUE INDEX uq_pending_email_open ON pending_registrations (email) WHERE closed_at IS NULL;
-- Job dọn rác quét theo hạn.
CREATE INDEX idx_pending_expires ON pending_registrations (expires_at);
