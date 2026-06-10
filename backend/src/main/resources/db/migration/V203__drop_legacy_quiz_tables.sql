-- V203: Drop legacy quiz system tables
--
-- All 7 tables below are orphaned: 0 JPA entities, 0 repositories, 0 active queries.
-- AdminManagementService was updated in the codebase review (Đợt 3) to query
-- class_assignments instead; VocabularyResetService comment was doc-only.
--
-- Drop order respects FK constraints (children before parents):
--   teacher_homework_submissions → quiz_sessions + classrooms
--   quiz_choices                 → quiz_questions
--   quiz_questions               → quizzes
--   quiz_sessions                → quizzes
--   classroom_students           → classrooms
--   quizzes                      → classrooms
--   classrooms                   (parent)
--
-- NOT dropped:
--   classroom_join_requests  — alive: ClassroomJoinRequest entity uses classroom_id
--                              to reference teacher_classes.id (no FK constraint)
--   user_placement_tests     — alive: used by PlacementTestService
--   quiz_questions_bank / interview_* — unrelated, in separate schema area

DROP TABLE IF EXISTS teacher_homework_submissions;
DROP TABLE IF EXISTS quiz_choices;
DROP TABLE IF EXISTS quiz_questions;
DROP TABLE IF EXISTS quiz_sessions;
DROP TABLE IF EXISTS classroom_students;
DROP TABLE IF EXISTS quizzes;
DROP TABLE IF EXISTS classrooms;
