-- ============================================================
-- V233 — Rotate the publicly-known default-credential password ("password123")
-- ============================================================
-- WHY (security, CRITICAL): V7/V8/V48/V50 seed the demo accounts
-- admin@/teacher@/student@deutschflow.com with bcrypt hash
-- $2a$10$5154iPnLlw5eoluwel66s.vNb5B6nA2lqUVYTbBxogJ/n8zLesHrW, and those
-- migrations spell out the plaintext "password123" in their comments — both the
-- hash and the plaintext are committed to the repo. Anyone reading the source can
-- therefore log in as the demo TEACHER (student data + grading) or STUDENT on any
-- environment that ran the seed, including prod. admin@ was rotated by hand on
-- live prod (2026-06-22); this migration makes the fix durable across DB rebuilds
-- and extends it to teacher@/student@.
--
-- DECISION (user, 2026-06-22): keep the demo accounts usable, but move them OFF
-- the public password.
--
-- IDEMPOTENT / NON-CLOBBERING: we only rotate rows that STILL hold the public hash.
--   • live prod, password already changed via the admin UI / self-service → hash
--     differs → this is a NO-OP (your hand-picked password is preserved);
--   • fresh rebuild → V7/V8 just re-seeded password123 → this catches it and
--     rotates to the strong random hash below.
--
-- LOCAL DEV: this rotates ONLY rows that still hold the public password123 hash.
-- scripts/seed-internal-accounts.sql sets the @deutschflow.com demo accounts to a
-- different password, so on a seeded local DB this is a no-op. A bare local DB (raw
-- V7/V8 seed) has its demo accounts rotated to the strong hash below — re-run the
-- seed script or sign up. (NB: db/migration-local/R__seed_demo_users_local.sql is
-- NOT wired into Flyway locations — locations = classpath:db/migration only — so it
-- never runs; do not rely on it to restore password123.)
--
-- We deliberately do NOT delete/relocate V7/V8/V48/V50: they are already applied on
-- prod, and removing them would trip Flyway validateOnMigrate (applied-but-missing).
-- Forward rotation is the Flyway-safe fix.
--
-- The new password is random (bcrypt below); the plaintext was delivered
-- out-of-band and is NOT committed. Rotate again anytime via
-- PATCH /api/admin/users/{id}/password.

UPDATE users
   SET password_hash = '$2a$10$0DAd6Mhu9czwKlLKwxUqku5yevwGea9kpPHBmvrVNqVIVo2/M6Ozm'
 WHERE email IN ('admin@deutschflow.com', 'teacher@deutschflow.com', 'student@deutschflow.com')
   AND password_hash = '$2a$10$5154iPnLlw5eoluwel66s.vNb5B6nA2lqUVYTbBxogJ/n8zLesHrW';
