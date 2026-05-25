package com.deutschflow.teacher.repository;

import com.deutschflow.teacher.entity.AssignmentScenario;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AssignmentScenarioRepository extends JpaRepository<AssignmentScenario, Long> {
    Optional<AssignmentScenario> findByAssignmentId(Long assignmentId);
}
