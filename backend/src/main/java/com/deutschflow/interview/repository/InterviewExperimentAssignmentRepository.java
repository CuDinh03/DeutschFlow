package com.deutschflow.interview.repository;

import com.deutschflow.interview.entity.InterviewExperimentAssignment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InterviewExperimentAssignmentRepository extends JpaRepository<InterviewExperimentAssignment, Long> {

    Optional<InterviewExperimentAssignment> findFirstByUserIdAndExperimentKeyOrderByAssignedAtDesc(
            Long userId, String experimentKey);

    List<InterviewExperimentAssignment> findBySessionId(Long sessionId);
}
