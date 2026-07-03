-- V243: fix the stale day_of_week CHECK left behind by V240.
--
-- V236 created class_schedule_patterns.day_of_week with an inline CHECK (day_of_week BETWEEN 0 AND 6)
-- (0=Mon..6=Sun). V240 migrated the *data* to ISO 1-7 (1=Mon..7=Sun) and the backend now writes
-- DayOfWeek.getValue() (1-7) — but the CHECK was never updated. Net effect: day_of_week = 7 (Sunday)
-- is rejected, so creating a Sunday class schedule 500s for every org that teaches on weekends.
-- (This is also why V240's "6 -> 7" UPDATE never failed: no Sunday rows could exist to migrate.)
--
-- Drop whatever CHECK currently constrains day_of_week (by definition, not by an assumed auto-name,
-- so this is robust to naming differences across environments) and re-add the ISO 1-7 range.
--
-- Rollback (manual — Flyway CE has no undo):
--   ALTER TABLE class_schedule_patterns DROP CONSTRAINT class_schedule_patterns_day_of_week_check;
--   ALTER TABLE class_schedule_patterns ADD CONSTRAINT class_schedule_patterns_day_of_week_check
--     CHECK (day_of_week BETWEEN 0 AND 6);

-- Assumption: the only CHECK on this table mentioning day_of_week is the single-column range check
-- from V236. If a future migration adds a *composite* CHECK that also references day_of_week, this
-- ILIKE match would drop it too — revisit the match then.
DO $$
DECLARE constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'class_schedule_patterns'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%day_of_week%'
  LOOP
    EXECUTE format('ALTER TABLE class_schedule_patterns DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE class_schedule_patterns
  ADD CONSTRAINT class_schedule_patterns_day_of_week_check
  CHECK (day_of_week BETWEEN 1 AND 7);
