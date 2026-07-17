-- V260: backfill StudentAssignment rows for students who joined a class AFTER assignments were handed out.
--
-- An assignment fans out into one student_assignments row per student AT CREATION TIME
-- (TeacherService.createAssignment). No enrollment path backfilled the older assignments for a
-- late-joining student, so that student had no row for them — yet the class counters (which iterate
-- class_assignments) still counted them as "chờ nộp". The student was told they had pending work they
-- could neither see in the list nor submit. AssignmentBackfillService now provisions these on every
-- enrollment going forward; this one-time backfill fixes the students who are already affected.
--
-- Insert a PENDING row for every (enrolled student × class assignment) pair that has none. Column
-- defaults fill status='PENDING', version=0, created_at=now(), is_deleted=false. Idempotent via NOT
-- EXISTS — safe to re-run.
INSERT INTO student_assignments (assignment_id, student_id)
SELECT ca.id, cs.student_id
FROM class_assignments ca
JOIN class_students cs ON cs.class_id = ca.class_id
WHERE NOT EXISTS (
    SELECT 1 FROM student_assignments sa
    WHERE sa.assignment_id = ca.id
      AND sa.student_id = cs.student_id
);
