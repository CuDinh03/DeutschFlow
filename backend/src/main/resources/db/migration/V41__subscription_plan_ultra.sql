INSERT INTO subscription_plans (code, name, monthly_token_limit, features_json, is_active)
SELECT 'ULTRA', 'Ultra', 500000, JSON_OBJECT('streaming', TRUE), 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE code = 'ULTRA');
