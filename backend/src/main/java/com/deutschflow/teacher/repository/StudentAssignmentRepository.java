package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.StudentAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface StudentAssignmentRepository extends JpaRepository<StudentAssignment, Long> {
    List<StudentAssignment> findByStudentIdOrderByCreatedAtDesc(Long studentId);
    Optional<StudentAssignment> findByStudentIdAndAssignmentId(Long studentId, Long assignmentId);

    @Query("SELECT COUNT(sa) FROM StudentAssignment sa WHERE sa.studentId = :studentId " +
           "AND sa.status IN ('GRADED','EVALUATED') AND sa.createdAt < :before")
    long countCompletedBefore(@Param("studentId") Long studentId, @Param("before") LocalDateTime before);

    @Query("SELECT COALESCE(AVG(sa.score), 0) FROM StudentAssignment sa WHERE sa.studentId = :studentId " +
           "AND sa.status IN ('GRADED','EVALUATED') AND sa.createdAt < :before AND sa.score IS NOT NULL")
    double avgScoreBefore(@Param("studentId") Long studentId, @Param("before") LocalDateTime before);

    @Query("SELECT COUNT(sa) FROM StudentAssignment sa WHERE sa.studentId = :studentId " +
           "AND sa.status IN ('GRADED','EVALUATED') AND sa.createdAt >= :after")
    long countCompletedAfter(@Param("studentId") Long studentId, @Param("after") LocalDateTime after);

    @Query("SELECT COALESCE(AVG(sa.score), 0) FROM StudentAssignment sa WHERE sa.studentId = :studentId " +
           "AND sa.status IN ('GRADED','EVALUATED') AND sa.createdAt >= :after AND sa.score IS NOT NULL")
    double avgScoreAfter(@Param("studentId") Long studentId, @Param("after") LocalDateTime after);

    @Query("SELECT COUNT(sa) FROM StudentAssignment sa WHERE sa.studentId = :studentId " +
           "AND sa.status = 'SUBMITTED'")
    long countPendingReview(@Param("studentId") Long studentId);

    @Query("SELECT sa FROM StudentAssignment sa WHERE sa.assignmentId = :assignmentId AND sa.deleted = false")
    List<StudentAssignment> findByAssignmentId(@Param("assignmentId") Long assignmentId);

    /**
     * The teacher's grading queue: everything handed in that still needs a human.
     *
     * <p>AI_GRADED is in here on purpose. The AI pass used to write GRADED, which dropped the row out of
     * this query — so a teacher who triggered "Chấm AI" and then reloaded lost the submission from the
     * queue entirely, leaving an unreviewed AI score standing as the final grade.
     */
    @Query("SELECT sa FROM StudentAssignment sa WHERE sa.assignmentId IN :assignmentIds "
           + "AND sa.status IN ('SUBMITTED','AI_GRADED','GRADING_FAILED') AND sa.deleted = false")
    List<StudentAssignment> findSubmittedByAssignmentIds(@Param("assignmentIds") List<Long> assignmentIds);

    @Query("SELECT sa FROM StudentAssignment sa WHERE sa.assignmentId IN :assignmentIds AND sa.deleted = false")
    List<StudentAssignment> findByAssignmentIds(@Param("assignmentIds") List<Long> assignmentIds);

    /**
     * One student's submissions, restricted to a given set of assignments — used by the teacher-facing
     * student detail view so it can only ever return work from classes that teacher actually shares
     * with the student (see {@code TeacherService.sharedAssignmentIds}).
     */
    List<StudentAssignment> findByStudentIdAndAssignmentIdInAndDeletedFalseOrderByCreatedAtDesc(
            Long studentId, List<Long> assignmentIds);

    /**
     * Weekly average of CONFIRMED grades per class, for the analytics trend chart. Each row is
     * [class_id, isoWeek ("2026-W24"), avgScore (0-100), gradedCount].
     *
     * <p>Bucketed on when the grade actually exists — {@code graded_at}, falling back to
     * {@code created_at} for legacy rows. Only GRADED/EVALUATED count: {@code graded_at} is also set
     * when the AI proposes a score (AI_GRADED), so filtering to the final statuses is what keeps
     * unconfirmed AI numbers out of the trend. Scores are clamped to [0,100] to match the rest of the
     * reporting. Returned oldest week first; the service keeps only the most recent buckets.
     */
    @Query(value = """
            SELECT ca.class_id,
                   to_char(date_trunc('week', COALESCE(sa.graded_at, sa.created_at)), 'IYYY-"W"IW'),
                   AVG(LEAST(GREATEST(sa.score, 0), 100)),
                   COUNT(*)
            FROM student_assignments sa
            JOIN class_assignments ca ON ca.id = sa.assignment_id
            WHERE ca.class_id IN (:classIds)
              AND sa.is_deleted = false
              AND sa.status IN ('GRADED', 'EVALUATED')
              AND sa.score IS NOT NULL
            GROUP BY ca.class_id, date_trunc('week', COALESCE(sa.graded_at, sa.created_at))
            ORDER BY date_trunc('week', COALESCE(sa.graded_at, sa.created_at))
            """, nativeQuery = true)
    List<Object[]> findWeeklyConfirmedAverages(@Param("classIds") List<Long> classIds);
}
