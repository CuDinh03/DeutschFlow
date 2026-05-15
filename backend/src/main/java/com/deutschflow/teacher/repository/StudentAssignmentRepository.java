package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.StudentAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StudentAssignmentRepository extends JpaRepository<StudentAssignment, Long> {
    List<StudentAssignment> findByStudentIdOrderByCreatedAtDesc(Long studentId);
    Optional<StudentAssignment> findByStudentIdAndAssignmentId(Long studentId, Long assignmentId);
}
