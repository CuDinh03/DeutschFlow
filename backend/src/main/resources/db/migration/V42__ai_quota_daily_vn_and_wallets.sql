-- Daily VN-calendar quota model + rollover wallet for PREMIUM/PRO and ULTRA
CREATE TABLE IF NOT EXISTS user_ai_token_wallets (
  user_id BIGINT NOT NULL PRIMARY KEY,
  balance BIGINT NOT NULL DEFAULT 0,
  last_accrual_local_date DATE NULL COMMENT 'Last Asia/Ho_Chi_Minh calendar date that received daily grant bump',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

ALTER TABLE subscription_plans
  ADD COLUMN daily_token_grant BIGINT NOT NULL DEFAULT 0 AFTER monthly_token_limit,
  ADD COLUMN wallet_cap_days SMALLINT NOT NULL DEFAULT 0 COMMENT '0=no wallet rollover; PREMIUM/ULTRA use 30' AFTER daily_token_grant;

-- DEFAULT: no AI allowance unless paid tier restores wallet manually by admin flows
INSERT INTO subscription_plans (code, name, monthly_token_limit, daily_token_grant, wallet_cap_days, features_json, is_active)
SELECT 'DEFAULT', 'Default', 0, 0, 0, JSON_OBJECT('streaming', FALSE), 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE code = 'DEFAULT');

UPDATE subscription_plans SET daily_token_grant = 50000, wallet_cap_days = 0, monthly_token_limit = 50000 WHERE code = 'FREE';
UPDATE subscription_plans SET daily_token_grant = 400000, wallet_cap_days = 30, monthly_token_limit = 400000 WHERE code = 'PRO';
UPDATE subscription_plans SET daily_token_grant = 850000, wallet_cap_days = 30, monthly_token_limit = 850000 WHERE code = 'ULTRA';
UPDATE subscription_plans SET daily_token_grant = 0, wallet_cap_days = 0, monthly_token_limit = 0 WHERE code = 'DEFAULT';
UPDATE subscription_plans SET daily_token_grant = 0, wallet_cap_days = 0, monthly_token_limit = 999999999 WHERE code = 'INTERNAL';

-- Existing FREE trials without end: cap at +7 calendar days from start (best-effort)
UPDATE user_subscriptions us
JOIN subscription_plans sp ON sp.code = us.plan_code AND sp.code = 'FREE'
SET us.ends_at = DATE_ADD(us.starts_at, INTERVAL 7 DAY),
    us.updated_at = CURRENT_TIMESTAMP
WHERE us.status = 'ACTIVE'
  AND us.ends_at IS NULL;

-- Students without any ACTIVE subscription: give a one-shot 7-day FREE window from migration time
INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, ends_at)
SELECT u.id, 'FREE', 'ACTIVE', CURRENT_TIMESTAMP(6), DATE_ADD(CURRENT_TIMESTAMP(6), INTERVAL 7 DAY)
FROM users u
WHERE u.role = 'STUDENT'
  AND NOT EXISTS (
    SELECT 1 FROM user_subscriptions s WHERE s.user_id = u.id AND s.status = 'ACTIVE'
  );
