package com.deutschflow.examspeaking.repository;

import com.deutschflow.examspeaking.entity.SpeakingExamTurn;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SpeakingExamTurnRepository extends JpaRepository<SpeakingExamTurn, Long> {

    List<SpeakingExamTurn> findBySessionIdOrderBySeqAsc(Long sessionId);

    int countBySessionIdAndPartNoAndRole(Long sessionId, int partNo, String role);
}
