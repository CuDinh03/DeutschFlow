-- ============================================================
-- Local-only seed: demo users for development/testing
-- Loaded only when profile "local" includes migration-local.
-- ============================================================

INSERT INTO users (email, password_hash, display_name, role, locale, is_active, created_at)
VALUES
    ('student@deutschflow.com',
     '$2a$10$5154iPnLlw5eoluwel66s.vNb5B6nA2lqUVYTbBxogJ/n8zLesHrW',
     'Demo Student',
     'STUDENT',
     'vi',
     TRUE,
     CURRENT_TIMESTAMP),

    ('teacher@deutschflow.com',
     '$2a$10$5154iPnLlw5eoluwel66s.vNb5B6nA2lqUVYTbBxogJ/n8zLesHrW',
     'Demo Teacher',
     'TEACHER',
     'en',
     TRUE,
     CURRENT_TIMESTAMP),

    ('admin@deutschflow.com',
     '$2a$10$5154iPnLlw5eoluwel66s.vNb5B6nA2lqUVYTbBxogJ/n8zLesHrW',
     'System Admin',
     'ADMIN',
     'de',
     TRUE,
     CURRENT_TIMESTAMP)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    locale = EXCLUDED.locale,
    is_active = EXCLUDED.is_active;
