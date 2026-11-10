package com.deutschflow.user.repository;

import com.deutschflow.user.entity.LearningSessionAttempt;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;

public interface LearningSessionAttemptRepository extends JpaRepository<LearningSessionAttempt, Long> {

    @Query("SELECT COALESCE(MAX(a.attemptNo), 0) FROM LearningSessionAttempt a WHERE a.user.id = :userId AND a.weekNumber = :week AND a.sessionIndex = :sessionIndex")
    int maxAttemptNo(Long userId, int week, int sessionIndex);

    /** Điểm tốt nhất server chấm cho một buổi; {@code null} khi chưa nộp lần nào (A2). */
    @Query("SELECT MAX(a.scorePercent) FROM LearningSessionAttempt a WHERE a.user.id = :userId AND a.weekNumber = :week AND a.sessionIndex = :sessionIndex")
    Integer maxScorePercent(Long userId, int week, int sessionIndex);

    List<LearningSessionAttempt> findByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtAsc(
            Long userId, LocalDateTime weekStartInclusive, LocalDateTime weekEndExclusive);

    Page<LearningSessionAttempt> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
}

