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
     CURRENT_TIMESTAMP(6)),

    ('teacher@deutschflow.com',
     '$2a$10$5154iPnLlw5eoluwel66s.vNb5B6nA2lqUVYTbBxogJ/n8zLesHrW',
     'Demo Teacher',
     'TEACHER',
     'en',
     TRUE,
     CURRENT_TIMESTAMP(6)),

    ('admin@deutschflow.com',
     '$2a$10$5154iPnLlw5eoluwel66s.vNb5B6nA2lqUVYTbBxogJ/n8zLesHrW',
     'System Admin',
     'ADMIN',
     'de',
     TRUE,
     CURRENT_TIMESTAMP(6)) AS new_users
ON DUPLICATE KEY UPDATE
    password_hash = new_users.password_hash,
    display_name = new_users.display_name,
    role = new_users.role,
    locale = new_users.locale,
    is_active = new_users.is_active;
