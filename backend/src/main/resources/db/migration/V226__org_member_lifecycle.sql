-- V226 — B2B model §4: OrgMember lifecycle. Add left_at + widen status to ACTIVE/REVOKED/LEFT.
-- status stays VARCHAR free-text (no enum/CHECK to keep additive + reversible). OrgGuard only ever
-- grants on status='ACTIVE', so REVOKED/LEFT both = no access.
-- Decision: plans/2026-06-21-b2b-model.md §4 + execution-plan B-2.
--
-- Rollback (manual — Flyway CE has no undo):
--   UPDATE org_members SET status = 'REMOVED' WHERE status IN ('REVOKED','LEFT');
--   ALTER TABLE org_members DROP COLUMN IF EXISTS left_at;

ALTER TABLE org_members ADD COLUMN IF NOT EXISTS left_at TIMESTAMP NULL;

-- Existing admin-removed rows were 'REMOVED' → reclassify as 'REVOKED' (admin action).
-- left_at unknown for historical rows → leave NULL.
UPDATE org_members SET status = 'REVOKED' WHERE status = 'REMOVED';
