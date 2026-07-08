-- Auto-grade audit (Đợt 3): optimistic lock on student_assignments.
--
-- Guards against a concurrent AI grade + teacher evaluate (or two simultaneous AI-grade triggers)
-- silently last-writer-wins and losing a grade. Hibernate @Version bumps this column on each update;
-- a stale write throws ObjectOptimisticLockingFailureException (mapped to 409 for user flows; the
-- async grade path catches it and no-ops via its EVALUATED/GRADED guard).
--
-- Existing rows default to 0; new rows are seeded to 0 by Hibernate on insert. Replay-safe.
ALTER TABLE student_assignments ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
