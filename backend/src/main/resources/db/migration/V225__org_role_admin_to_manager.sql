-- V225 — B2B model §1: rename ORG-role ADMIN → MANAGER.
-- PLATFORM-ADMIN stays User.Role.ADMIN (users.role) — untouched.
-- Org-role lives as free text in org_members.role / org_invitations.role; this renames existing rows.
-- Decision: plans/2026-06-21-b2b-model.md §1. ACCOUNTANT dropped in code (D2); no ACCOUNTANT rows expected.
--
-- Rollback (manual — Flyway CE has no undo):
--   UPDATE org_members     SET role = 'ADMIN' WHERE role = 'MANAGER';
--   UPDATE org_invitations SET role = 'ADMIN' WHERE role = 'MANAGER';

-- Fail loudly if any ACCOUNTANT membership exists: D2 drops the role, so a residual row would
-- silently lose finance access. Reassign such rows before applying V225. (No rows expected —
-- ACCOUNTANT was never assignable.)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM org_members WHERE role = 'ACCOUNTANT') THEN
    RAISE EXCEPTION 'V225: org_members.role=ACCOUNTANT rows exist — reassign to OWNER/MANAGER before applying (ACCOUNTANT dropped per D2).';
  END IF;
END $$;

UPDATE org_members     SET role = 'MANAGER' WHERE role = 'ADMIN';
UPDATE org_invitations SET role = 'MANAGER' WHERE role = 'ADMIN';
