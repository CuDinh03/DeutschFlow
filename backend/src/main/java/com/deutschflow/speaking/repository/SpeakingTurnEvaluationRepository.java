package com.deutschflow.speaking.repository;

import com.deutschflow.speaking.entity.SpeakingTurnEvaluation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SpeakingTurnEvaluationRepository extends JpaRepository<SpeakingTurnEvaluation, Long> {

    @Query("""
            SELECT e FROM SpeakingTurnEvaluation e
            WHERE e.userId = :userId
            ORDER BY e.createdAt DESC
            """)
    List<SpeakingTurnEvaluation> findRecentByUserId(@Param("userId") Long userId,
                                                    org.springframework.data.domain.Pageable pageable);
}
