-- Subscription plans and per-user subscriptions (admin-managed tiers + overrides)
CREATE TABLE subscription_plans (
    code VARCHAR(32) NOT NULL PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    monthly_token_limit BIGINT NOT NULL,
    features_json JSON NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_subscriptions (
    id BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    plan_code VARCHAR(32) NOT NULL,
    status VARCHAR(16) NOT NULL,
    starts_at TIMESTAMP NOT NULL,
    ends_at TIMESTAMP NULL,
    monthly_token_limit_override BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_subscriptions_user_status (user_id, status),
    INDEX idx_user_subscriptions_user_plan (user_id, plan_code),
    CONSTRAINT fk_user_subscriptions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_user_subscriptions_plan FOREIGN KEY (plan_code) REFERENCES subscription_plans (code)
);

-- Seed default plans (safe to re-run? Flyway runs once; insert-only is fine)
INSERT INTO subscription_plans (code, name, monthly_token_limit, features_json, is_active) VALUES
('FREE', 'Free', 20000, JSON_OBJECT('streaming', FALSE), 1),
('PRO', 'Pro', 200000, JSON_OBJECT('streaming', TRUE), 1),
('INTERNAL', 'Internal', 999999999, JSON_OBJECT('streaming', TRUE), 1);

