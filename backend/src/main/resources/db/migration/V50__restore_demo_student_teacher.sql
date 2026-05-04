-- Khôi phục học sinh + giáo viên demo sau V11 (V11 chỉ giữ staging/prod không còn 3 demo user).
-- V48 đã khôi phục admin; thêm hai tài khoản còn lại khớp R__seed_demo_users_local và V7.
-- Mật khẩu (BCrypt đã hash): password123 — cùng hash V7/V48.

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
     CURRENT_TIMESTAMP)

ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    display_name  = EXCLUDED.display_name,
    role          = EXCLUDED.role,
    locale        = EXCLUDED.locale,
    is_active     = EXCLUDED.is_active;
