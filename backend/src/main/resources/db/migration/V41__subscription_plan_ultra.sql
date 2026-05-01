INSERT INTO subscription_plans (code, name, monthly_token_limit, features_json, is_active)
SELECT 'ULTRA', 'Ultra', 500000, json_build_object('streaming', TRUE), TRUE
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE code = 'ULTRA');
