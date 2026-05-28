package com.deutschflow.interview.repository;

import com.deutschflow.interview.entity.InterviewPhaseResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InterviewPhaseResultRepository extends JpaRepository<InterviewPhaseResult, Long> {

    List<InterviewPhaseResult> findBySessionIdOrderByPhaseAsc(Long sessionId);

    Optional<InterviewPhaseResult> findBySessionIdAndPhase(Long sessionId, String phase);
}
