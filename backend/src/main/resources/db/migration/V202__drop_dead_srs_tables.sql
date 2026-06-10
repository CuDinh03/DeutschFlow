-- V202 — Drop dead SRS tables (DB-H8).
--
-- Two tables are dead duplicates of the canonical SRS schedule and are mapped by
-- no entity, queried by no repository/native SQL, and targeted by no FK:
--
--   * spaced_repetition_schedule (V152) — duplicate of vocab_review_schedule (V110,
--     the canonical FSRS schedule table that SrsVocabScheduler actually writes).
--   * user_word_progress (V3) — superseded legacy per-word progress; nothing reads it.
--
-- Verified before drop:
--   - 0 references in backend Java (entity @Table, JdbcTemplate, JPQL).
--   - 0 inbound FK constraints from any other table (grep over all migrations).
--   - Each table is created once and never altered by a later migration.
--
-- IF EXISTS keeps fresh-DB replay (where V152/V3 created them first) and prod (where
-- they exist historically) both clean. No CASCADE: there are no dependents, so a plain
-- DROP succeeds — and would fail loudly rather than silently cascade if that ever changed.
--
-- NOT dropped here (deliberately deferred): the legacy quiz tables
-- (classrooms, classroom_students, classroom_join_requests, quizzes, quiz_questions,
-- quiz_choices, quiz_sessions). Although BE-C3 removed the last query against them,
-- V125 (teacher_ai_homework_and_srs) added an FK chain into quiz_sessions/classrooms,
-- so dropping them needs its own dead-or-alive determination of that homework table
-- and a correct drop order. That is a separate, deliberate decision (per the review)
-- and is intentionally out of scope for this hygiene migration to avoid a Flyway-halting
-- deploy failure.

DROP TABLE IF EXISTS spaced_repetition_schedule;
DROP TABLE IF EXISTS user_word_progress;
