-- ============================================================
-- V7: SEED DEFAULT USERS
-- Tạo 3 tài khoản mặc định: student, teacher, admin
-- Password cho cả 3: "password123"
-- BCrypt hash: $2a$10$5154iPnLlw5eoluwel66s.vNb5B6nA2lqUVYTbBxogJ/n8zLesHrW
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
     CURRENT_TIMESTAMP(6));
