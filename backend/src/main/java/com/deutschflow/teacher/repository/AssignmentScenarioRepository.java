package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.AssignmentScenario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AssignmentScenarioRepository extends JpaRepository<AssignmentScenario, Long> {
    Optional<AssignmentScenario> findByAssignmentId(Long assignmentId);

    /**
     * Like {@link #findByAssignmentId} but tolerant of the rare duplicate row a cross-student race
     * in lazy generation could create — returns the earliest instead of throwing
     * IncorrectResultSizeDataAccessException.
     */
    Optional<AssignmentScenario> findFirstByAssignmentIdOrderByIdAsc(Long assignmentId);
}
