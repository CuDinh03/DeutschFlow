-- ============================================================
-- V11: REMOVE DEMO USERS FROM SHARED ENVIRONMENTS
-- Safety migration to ensure demo accounts do not remain
-- in staging/production databases.
-- ============================================================

DELETE FROM refresh_tokens
WHERE user_id IN (
    SELECT id FROM users
    WHERE email IN ('student@deutschflow.com', 'teacher@deutschflow.com', 'admin@deutschflow.com')
);

DELETE FROM users
WHERE email IN ('student@deutschflow.com', 'teacher@deutschflow.com', 'admin@deutschflow.com');
