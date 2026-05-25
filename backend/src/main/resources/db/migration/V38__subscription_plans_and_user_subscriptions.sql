-- Subscription plans and per-user subscriptions (admin-managed tiers + overrides)
CREATE TABLE subscription_plans  (
    code VARCHAR(32) NOT NULL PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    monthly_token_limit BIGINT NOT NULL,
    features_json JSONB NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE user_subscriptions  (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    plan_code VARCHAR(32) NOT NULL,
    status VARCHAR(16) NOT NULL,
    starts_at TIMESTAMP NOT NULL,
    ends_at TIMESTAMP NULL,
    monthly_token_limit_override BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_subscriptions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_user_subscriptions_plan FOREIGN KEY (plan_code) REFERENCES subscription_plans (code)
);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status ON user_subscriptions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_plan ON user_subscriptions (user_id, plan_code);


-- Seed default plans (safe to re-run? Flyway runs once; insert-only is fine)
INSERT INTO subscription_plans (code, name, monthly_token_limit, features_json, is_active) VALUES
('FREE', 'Free', 20000, json_build_object('streaming', FALSE), TRUE),
('PRO', 'Pro', 200000, json_build_object('streaming', TRUE), TRUE),
('INTERNAL', 'Internal', 999999999, json_build_object('streaming', TRUE), TRUE);
