-- ============================================================
-- V8: FIX DEFAULT USERS PASSWORD
-- Update password hash cho 3 tài khoản mặc định
-- Password: "password123"
-- ============================================================

UPDATE users 
SET password_hash = '$2a$10$5154iPnLlw5eoluwel66s.vNb5B6nA2lqUVYTbBxogJ/n8zLesHrW'
WHERE email IN ('student@deutschflow.com', 'teacher@deutschflow.com', 'admin@deutschflow.com');
