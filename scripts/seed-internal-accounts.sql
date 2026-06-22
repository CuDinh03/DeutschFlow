-- ============================================================
-- Seed: tài khoản nội bộ (QA) — mỗi vai trò 1 tài khoản, TRỪ platform ADMIN.
-- Idempotent / chạy lại được. Mật khẩu CHUNG: Admin12345!
-- (hash = $2a$10$UfefJmwst8TRLj9arqAPauLF6RJwf3kpEWs8GiyKpBxoTHh4qeeGC — cùng hash với
--  student@deutschflow.com / admin@local.test đang dùng Admin12345!).
--
-- KHÔNG đụng vào tài khoản platform-ADMIN (admin@deutschflow.com) — theo yêu cầu.
--
-- Chạy local:
--   docker exec -e PGPASSWORD=<pw> -i deutschflow-postgres \
--     psql -U <user> -d <db> -f - < scripts/seed-internal-accounts.sql
--
-- LƯU Ý: cần CHECK constraint org_members/org_invitations đã cho phép 'MANAGER'
-- (migration V229). Nếu DB chưa migrate tới V229, chạy phần "constraint" ở cuối file trước.
-- ============================================================

-- ── 1) Tài khoản OWNER + MANAGER (platform-role TEACHER; vai trò org gán qua org_members) ──
INSERT INTO users (email, password_hash, display_name, role, locale, is_active, created_at)
VALUES
    ('owner@deutschflow.com',
     '$2a$10$UfefJmwst8TRLj9arqAPauLF6RJwf3kpEWs8GiyKpBxoTHh4qeeGC',
     'Demo Org Owner', 'TEACHER', 'vi', TRUE, CURRENT_TIMESTAMP),
    ('manager@deutschflow.com',
     '$2a$10$UfefJmwst8TRLj9arqAPauLF6RJwf3kpEWs8GiyKpBxoTHh4qeeGC',
     'Demo Org Manager', 'TEACHER', 'vi', TRUE, CURRENT_TIMESTAMP)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    display_name  = EXCLUDED.display_name,
    role          = EXCLUDED.role,
    is_active     = TRUE;

-- ── 2) Chuẩn hoá mật khẩu STUDENT/TEACHER demo về Admin12345! (admin@ giữ nguyên) ──
UPDATE users
   SET password_hash = '$2a$10$UfefJmwst8TRLj9arqAPauLF6RJwf3kpEWs8GiyKpBxoTHh4qeeGC'
 WHERE email IN ('student@deutschflow.com', 'teacher@deutschflow.com');

-- ── 3) Tách bạch quyền sở hữu org1 "abc-center" để "teacher" ≠ owner/manager ──
--     Trước đây teacher@local.test là OWNER abc-center → đăng nhập nhảy vào /v2/org (trung tâm).
--     Hạ nó xuống TEACHER (giữ bất biến 1-OWNER-ACTIVE) rồi cho owner@deutschflow làm CHỦ.
UPDATE org_members
   SET role = 'TEACHER'
 WHERE org_id  = (SELECT id FROM organizations WHERE slug = 'abc-center')
   AND role    = 'OWNER'
   AND user_id = (SELECT id FROM users WHERE email = 'teacher@local.test');

-- owner@deutschflow = OWNER của abc-center (org đông học viên/giáo viên để test)
INSERT INTO org_members (org_id, user_id, role, status, joined_at)
SELECT o.id, u.id, 'OWNER', 'ACTIVE', CURRENT_TIMESTAMP
  FROM organizations o, users u
 WHERE o.slug = 'abc-center' AND u.email = 'owner@deutschflow.com'
ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'OWNER', status = 'ACTIVE';

-- ── 4) manager@deutschflow = MANAGER của abc-center ──
INSERT INTO org_members (org_id, user_id, role, status, joined_at)
SELECT o.id, u.id, 'MANAGER', 'ACTIVE', CURRENT_TIMESTAMP
  FROM organizations o, users u
 WHERE o.slug = 'abc-center' AND u.email = 'manager@deutschflow.com'
ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'MANAGER', status = 'ACTIVE';

-- ── 5) owner@ + manager@ thuộc abc-center (bất biến users.org_id == org_members ACTIVE) ──
UPDATE users
   SET org_id = (SELECT id FROM organizations WHERE slug = 'abc-center')
 WHERE email IN ('owner@deutschflow.com', 'manager@deutschflow.com');

-- ── 6) Dọn org demo trống cũ (owner@ đã chuyển sang abc-center) ──
DELETE FROM org_members
 WHERE org_id = (SELECT id FROM organizations WHERE slug = 'deutschflow-demo');
DELETE FROM organizations WHERE slug = 'deutschflow-demo';

-- ── (Tuỳ chọn) constraint cho DB chưa migrate tới V229 — bỏ comment nếu cần chạy tay ──
-- ALTER TABLE org_members     DROP CONSTRAINT IF EXISTS org_members_role_check;
-- ALTER TABLE org_members     ADD  CONSTRAINT org_members_role_check
--      CHECK (role IN ('OWNER','MANAGER','TEACHER','STUDENT'));
-- ALTER TABLE org_invitations DROP CONSTRAINT IF EXISTS org_invitations_role_check;
-- ALTER TABLE org_invitations ADD  CONSTRAINT org_invitations_role_check
--      CHECK (role IN ('MANAGER','TEACHER','STUDENT'));
