-- ============================================================
-- V196: Add missing foreign keys (P0-13 — referential integrity)
-- ============================================================
-- Several relationship tables stored user_id / class_id as a bare BIGINT with NO
-- foreign key, so deleting a user (or class) left orphan rows that point at a row
-- that no longer exists. This migration:
--   1. Deletes any pre-existing orphan rows (rows whose parent is already gone),
--      because PostgreSQL refuses to add a FK while violating rows exist.
--   2. Adds the missing FKs with ON DELETE CASCADE so future deletes stay consistent.
--   3. Adds the one missing supporting index (PostgreSQL does NOT auto-index FK
--      columns, and an unindexed FK makes cascade deletes + joins slow).
--
-- Every ALTER is wrapped in a pg_constraint guard so the migration is safe to re-run
-- and is a no-op where the constraint somehow already exists. users.id is BIGINT
-- (IDENTITY); all child columns are BIGINT NOT NULL, so the references are type-clean.
-- ============================================================

-- ── teacher_classes.teacher_id → users(id) ──────────────────
DELETE FROM teacher_classes tc
 WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = tc.teacher_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_teacher_classes_teacher') THEN
    ALTER TABLE teacher_classes
      ADD CONSTRAINT fk_teacher_classes_teacher
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── class_students.class_id → teacher_classes(id) ───────────
-- ── class_students.student_id → users(id) ───────────────────
DELETE FROM class_students cs
 WHERE NOT EXISTS (SELECT 1 FROM teacher_classes tc WHERE tc.id = cs.class_id)
    OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = cs.student_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_class_students_class') THEN
    ALTER TABLE class_students
      ADD CONSTRAINT fk_class_students_class
      FOREIGN KEY (class_id) REFERENCES teacher_classes(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_class_students_student') THEN
    ALTER TABLE class_students
      ADD CONSTRAINT fk_class_students_student
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── class_assignments.class_id → teacher_classes(id) ────────
DELETE FROM class_assignments ca
 WHERE NOT EXISTS (SELECT 1 FROM teacher_classes tc WHERE tc.id = ca.class_id);

CREATE INDEX IF NOT EXISTS idx_class_assignments_class_id ON class_assignments(class_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_class_assignments_class') THEN
    ALTER TABLE class_assignments
      ADD CONSTRAINT fk_class_assignments_class
      FOREIGN KEY (class_id) REFERENCES teacher_classes(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── student_assignments.student_id → users(id) ──────────────
-- (assignment_id already has fk_sa_assignment from V134; only student_id was missing)
DELETE FROM student_assignments sa
 WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = sa.student_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_student_assignments_student') THEN
    ALTER TABLE student_assignments
      ADD CONSTRAINT fk_student_assignments_student
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── user_xp_events.user_id → users(id) ──────────────────────
DELETE FROM user_xp_events e
 WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = e.user_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_xp_events_user') THEN
    ALTER TABLE user_xp_events
      ADD CONSTRAINT fk_user_xp_events_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── user_achievements.user_id → users(id) ───────────────────
-- (achievement_id already references achievements(id) inline from V58)
DELETE FROM user_achievements ua
 WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ua.user_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_achievements_user') THEN
    ALTER TABLE user_achievements
      ADD CONSTRAINT fk_user_achievements_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── ai_token_usage_events.user_id → users(id) ───────────────
-- Quota/cost ledger. Cascade-delete with the user is acceptable (no cross-user
-- aggregate depends on a deleted user's rows; admin reports scope by user_id).
DELETE FROM ai_token_usage_events ae
 WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ae.user_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ai_token_usage_user') THEN
    ALTER TABLE ai_token_usage_events
      ADD CONSTRAINT fk_ai_token_usage_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;
