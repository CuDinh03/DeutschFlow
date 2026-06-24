-- V240: Migrate class_schedule_patterns.day_of_week from 0-based (0=Mon..6=Sun)
-- to ISO 1-7 (1=Mon..7=Sun). Backend now uses DayOfWeek.getValue() directly.
-- Safe to re-run (WHERE guards against already-migrated rows).

UPDATE class_schedule_patterns
SET    day_of_week = day_of_week + 1
WHERE  day_of_week BETWEEN 0 AND 6;
