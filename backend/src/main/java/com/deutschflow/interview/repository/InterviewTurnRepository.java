package com.deutschflow.interview.repository;

import com.deutschflow.interview.entity.InterviewTurn;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface InterviewTurnRepository extends JpaRepository<InterviewTurn, Long> {

    List<InterviewTurn> findBySessionIdOrderByTurnIndexAsc(Long sessionId);

    int countBySessionId(Long sessionId);
}
