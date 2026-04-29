package com.deutschflow.user.repository;

import com.deutschflow.user.entity.LearningSessionAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;

public interface LearningSessionAttemptRepository extends JpaRepository<LearningSessionAttempt, Long> {

    @Query("SELECT COALESCE(MAX(a.attemptNo), 0) FROM LearningSessionAttempt a WHERE a.user.id = :userId AND a.weekNumber = :week AND a.sessionIndex = :sessionIndex")
    int maxAttemptNo(Long userId, int week, int sessionIndex);

    List<LearningSessionAttempt> findByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtAsc(
            Long userId, LocalDateTime weekStartInclusive, LocalDateTime weekEndExclusive);
}

