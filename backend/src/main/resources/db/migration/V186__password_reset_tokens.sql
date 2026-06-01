-- Password reset OTP tokens for the "Quên mật khẩu" / forgot-password flow.
-- A 6-digit numeric code is stored in plain text (short-lived, low entropy is
-- acceptable for this use case — the TTL is 15 minutes and codes expire after
-- one successful use). The email field is indexed for fast lookup.

CREATE TABLE password_reset_tokens (
    id          BIGSERIAL PRIMARY KEY,
    email       VARCHAR(255) NOT NULL,
    code        VARCHAR(6)   NOT NULL,
    expires_at  TIMESTAMPTZ  NOT NULL,
    used        BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prt_email ON password_reset_tokens (email);
CREATE INDEX idx_prt_email_code ON password_reset_tokens (email, code) WHERE NOT used;
