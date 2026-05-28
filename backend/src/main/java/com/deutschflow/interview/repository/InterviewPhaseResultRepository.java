package com.deutschflow.interview.repository;

import com.deutschflow.interview.entity.InterviewPhaseResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface InterviewPhaseResultRepository extends JpaRepository<InterviewPhaseResult, Long> {

    List<InterviewPhaseResult> findBySessionIdOrderByPhaseAsc(Long sessionId);

    Optional<InterviewPhaseResult> findBySessionIdAndPhase(Long sessionId, String phase);

    /** Phase funnel: how many distinct sessions reached each phase (one query, not N+1). */
    @Query("SELECT pr.phase as phase, COUNT(DISTINCT pr.sessionId) as sessionCount, " +
           "AVG(pr.score) as avgScore " +
           "FROM InterviewPhaseResult pr GROUP BY pr.phase")
    List<PhaseAggregate> aggregateByPhase();

    /** Avg score per session (used to join with industry data in one pass). */
    @Query("SELECT pr.sessionId as sessionId, AVG(pr.score) as avgScore " +
           "FROM InterviewPhaseResult pr GROUP BY pr.sessionId")
    List<SessionScoreAggregate> avgScorePerSession();

    interface PhaseAggregate {
        String getPhase();
        Long getSessionCount();
        Double getAvgScore();
    }

    interface SessionScoreAggregate {
        Long getSessionId();
        Double getAvgScore();
    }
}
