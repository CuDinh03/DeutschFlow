-- Apple StoreKit In-App Purchase support.
--
-- Native iOS sells subscriptions via Apple IAP (auto-renewable). Apple becomes a third
-- payment "provider" alongside Stripe/MoMo, reusing the existing provider-agnostic
-- entitlement layer (user_subscriptions). This migration is purely additive:
--   1. apple_subscriptions  — Apple-side ledger keyed by originalTransactionId (lifecycle + user correlation)
--   2. apple_products       — productId -> plan_code mapping (server trusts this, not Apple's price)
--   3. users.apple_app_account_token — stable per-user UUID attached at purchase to correlate ASSN V2
--   4. user_subscriptions.source — distinguishes Apple-originated entitlement rows so Apple
--      refund/expire events only end Apple rows, never a web Stripe/MoMo entitlement.

-- 1. Apple subscription ledger -------------------------------------------------------------
CREATE TABLE apple_subscriptions (
    original_transaction_id VARCHAR(64) PRIMARY KEY,
    user_id                 BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    product_id              VARCHAR(128) NOT NULL,
    plan_code               VARCHAR(32)  NOT NULL REFERENCES subscription_plans (code),
    status                  VARCHAR(24)  NOT NULL,          -- ACTIVE / GRACE / EXPIRED / REVOKED / REFUNDED
    expires_at              TIMESTAMP,                       -- = Apple expiresDate; drives user_subscriptions.ends_at
    auto_renew_status       BOOLEAN,
    environment             VARCHAR(16)  NOT NULL,           -- Sandbox / Production / LocalTesting / Xcode
    latest_transaction_id   VARCHAR(64),
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_apple_subs_user ON apple_subscriptions (user_id);

-- 2. Product mapping (Apple price is managed in App Store Connect, not here) -----------------
CREATE TABLE apple_products (
    product_id      VARCHAR(128) PRIMARY KEY,
    plan_code       VARCHAR(32) NOT NULL REFERENCES subscription_plans (code),
    duration_months INT NOT NULL DEFAULT 1,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

-- Fresh-replay safety: ULTRA plan is never INSERTed by an earlier migration (only UPDATEd by V42
-- assuming the row existed). Seed it here with ON CONFLICT DO NOTHING so existing DBs are no-ops.
INSERT INTO subscription_plans (code, name, monthly_token_limit, features_json, is_active)
VALUES ('ULTRA', 'Ultra', 850000, '{}'::jsonb, TRUE)
ON CONFLICT (code) DO NOTHING;

-- Seed the catalog. Product IDs must match those created in App Store Connect.
-- Decision (2026-06-02): offer monthly + yearly for both PRO and ULTRA.
INSERT INTO apple_products (product_id, plan_code, duration_months, is_active) VALUES
    ('com.deutschflow.app.pro.monthly',   'PRO',    1,  TRUE),
    ('com.deutschflow.app.pro.yearly',    'PRO',    12, TRUE),
    ('com.deutschflow.app.ultra.monthly', 'ULTRA',  1,  TRUE),
    ('com.deutschflow.app.ultra.yearly',  'ULTRA',  12, TRUE);

-- 3. Per-user appAccountToken for ASSN V2 correlation ---------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_app_account_token UUID;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_apple_app_account_token
    ON users (apple_app_account_token) WHERE apple_app_account_token IS NOT NULL;

-- 4. Mark the provider that owns an entitlement row (nullable: existing rows pre-date this) --
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS source VARCHAR(16);

-- 5. Exactly-once guard for App Store Server Notifications V2 (Apple delivers at-least-once) --------
CREATE TABLE apple_processed_notifications (
    notification_uuid VARCHAR(64) PRIMARY KEY,
    notification_type VARCHAR(48),
    processed_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
