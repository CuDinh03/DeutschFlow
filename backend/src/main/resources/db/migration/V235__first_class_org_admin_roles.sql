-- ============================================================
-- V235 — First-class org-admin platform roles: backfill users.role for OWNER/MANAGER
-- ============================================================
-- Pairs with User.Role gaining MANAGER + OWNER (2026-06-22). Org admins were historically stored as
-- platform TEACHER (a manager/owner was modelled as "a teacher in the org"). This sets their platform
-- role to match their ACTIVE org membership, so they route to /v2/org and are no longer counted/shown
-- as teachers, and so `hasRole('TEACHER')` endpoints no longer admit them (strict separation —
-- org admins are administrative only, they do NOT inherit teacher capabilities).
--
-- DEPLOY ORDER: this is V235 and MUST be applied AFTER #151's V233/V234 (Flyway out-of-order=false).
-- Idempotent; never downgrades a platform ADMIN; OWNER takes precedence over MANAGER. users.role has
-- no CHECK constraint (@Enumerated STRING) so the new values insert cleanly.

UPDATE users u
   SET role = 'OWNER'
  FROM org_members m
 WHERE m.user_id = u.id
   AND m.status  = 'ACTIVE'
   AND m.role    = 'OWNER'
   AND u.role NOT IN ('ADMIN', 'OWNER');

UPDATE users u
   SET role = 'MANAGER'
  FROM org_members m
 WHERE m.user_id = u.id
   AND m.status  = 'ACTIVE'
   AND m.role    = 'MANAGER'
   AND u.role NOT IN ('ADMIN', 'OWNER', 'MANAGER');
