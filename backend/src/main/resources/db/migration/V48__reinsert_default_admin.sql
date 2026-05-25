-- Restore default admin removed by V11 (demo user cleanup).
-- Same credentials as V7: email admin@deutschflow.com, password "password123".
-- BCrypt: $2a$10$5154iPnLlw5eoluwel66s.vNb5B6nA2lqUVYTbBxogJ/n8zLesHrW

INSERT INTO users (email, password_hash, display_name, role, locale, is_active, created_at)
VALUES (
    'admin@deutschflow.com',
    '$2a$10$5154iPnLlw5eoluwel66s.vNb5B6nA2lqUVYTbBxogJ/n8zLesHrW',
    'System Admin',
    'ADMIN',
    'vi',
    TRUE,
    CURRENT_TIMESTAMP
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    display_name  = EXCLUDED.display_name,
    role          = EXCLUDED.role,
    locale        = EXCLUDED.locale,
    is_active     = EXCLUDED.is_active;
