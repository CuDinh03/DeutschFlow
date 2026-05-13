-- ============================================================
-- V129: Payment Gateway — MoMo/VNPay Integration
-- Adds price_vnd / discount_price_vnd to subscription_plans
-- Creates payment_transactions table for audit trail
-- ============================================================

-- 1. Add pricing columns to subscription_plans
ALTER TABLE subscription_plans
    ADD COLUMN IF NOT EXISTS price_vnd          BIGINT   NULL,
    ADD COLUMN IF NOT EXISTS discount_price_vnd BIGINT   NULL,
    ADD COLUMN IF NOT EXISTS duration_months    INT      NOT NULL DEFAULT 1;

-- 2. Set prices for existing plans (PRO=299k, ULTRA=699k, FREE/DEFAULT/INTERNAL=0)
UPDATE subscription_plans SET price_vnd = 299000, duration_months = 1 WHERE code = 'PRO';
UPDATE subscription_plans SET price_vnd = 699000, duration_months = 1 WHERE code = 'ULTRA';
UPDATE subscription_plans SET price_vnd = 0,      duration_months = 1 WHERE code IN ('FREE', 'DEFAULT', 'INTERNAL');

-- 3. Create payment_transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
    id                      BIGSERIAL PRIMARY KEY,
    order_id                VARCHAR(64)    NOT NULL UNIQUE,   -- ID ta tạo ra gửi cho MoMo
    user_id                 BIGINT         NOT NULL,
    plan_code               VARCHAR(32)    NOT NULL,
    amount                  BIGINT         NOT NULL,          -- Số tiền VND
    provider                VARCHAR(16)    NOT NULL DEFAULT 'MOMO', -- 'MOMO' | 'VNPAY'
    status                  VARCHAR(16)    NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED'
    provider_transaction_id VARCHAR(128)   NULL,              -- Mã giao dịch từ MoMo
    provider_message        TEXT           NULL,              -- Thông báo từ MoMo (lỗi hoặc thành công)
    raw_ipn_payload         JSONB          NULL,              -- Lưu toàn bộ IPN payload để audit
    created_at              TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_tx_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_payment_tx_plan FOREIGN KEY (plan_code) REFERENCES subscription_plans (code)
);

CREATE INDEX IF NOT EXISTS idx_payment_tx_user    ON payment_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_status  ON payment_transactions (status);
CREATE INDEX IF NOT EXISTS idx_payment_tx_orderid ON payment_transactions (order_id);
