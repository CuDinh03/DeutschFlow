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
}
