-- Xác thực hai lớp (TOTP, RFC 6238) BẮT BUỘC cho mọi tài khoản ADMIN (owner chốt 09/11/2026).
--
-- Bảng:
--   user_mfa                 — một dòng/người: bí mật TOTP đã MÃ HOÁ (AES-256-GCM, khoá ngoài DB —
--                              MFA_ENCRYPTION_KEY), enabled_at NULL = đang đăng ký dở (chưa xác nhận mã),
--                              last_used_step = bước thời gian 30 s của mã TOTP gần nhất đã dùng (chống
--                              phát lại: một mã chỉ dùng được một lần, kể cả trong cửa sổ ±1 bước).
--   user_mfa_recovery_codes  — 10 mã khôi phục dùng-một-lần, chỉ lưu HMAC-SHA256 (pepper ngoài DB).
--   mfa_email_codes          — mã 6 số gửi qua email ở lần đăng ký 2FA đầu tiên (chứng minh giữ hộp thư),
--                              HMAC như mã quên mật khẩu (V366), đếm lần sai, 10 phút.
--   refresh_tokens.mfa_verified_at — thời điểm phiên này qua bước 2FA. Refresh của ADMIN không có giá trị
--                              này (hoặc quá app.security.admin-mfa.max-session-hours) bị từ chối.
--
-- TƯƠNG THÍCH NGƯỢC (QUY_TRINH_PHAT_HANH §6.2): chỉ THÊM bảng và một cột NULL được. Màu cũ không đọc/ghi
-- các bảng mới và vẫn INSERT refresh_tokens như trước (cột mới để NULL). Refresh token do màu cũ phát cho
-- ADMIN sẽ bị màu mới từ chối — chủ ý: mọi phiên admin phải đăng nhập lại và qua 2FA sau khi deploy.

CREATE TABLE user_mfa (
    user_id        BIGINT      PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    -- "v1:<keyId>:<base64(iv|ciphertext|tag)>", AAD = user_id — không bao giờ lưu bí mật thô.
    secret_enc     TEXT        NOT NULL,
    enabled_at     TIMESTAMPTZ NULL,
    last_used_step BIGINT      NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NULL
);

CREATE TABLE user_mfa_recovery_codes (
    id         BIGSERIAL    PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- Hex HMAC-SHA256(pepper, "uid:<id>:<mã chuẩn hoá>").
    code_hash  VARCHAR(128) NOT NULL,
    used_at    TIMESTAMPTZ  NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_mfa_recovery_codes_unused
    ON user_mfa_recovery_codes (user_id)
    WHERE used_at IS NULL;

CREATE TABLE mfa_email_codes (
    id          BIGSERIAL   PRIMARY KEY,
    user_id     BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- Hex HMAC-SHA256(pepper, id + ":" + mã) — ghi ngay sau INSERT trong cùng transaction.
    code_hash   VARCHAR(64) NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    attempts    INT         NOT NULL DEFAULT 0,
    consumed_at TIMESTAMPTZ NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mfa_email_codes_open
    ON mfa_email_codes (user_id, created_at DESC)
    WHERE consumed_at IS NULL;

ALTER TABLE refresh_tokens ADD COLUMN mfa_verified_at TIMESTAMPTZ NULL;
