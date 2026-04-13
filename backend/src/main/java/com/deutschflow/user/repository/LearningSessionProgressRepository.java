package com.deutschflow.user.repository;

import com.deutschflow.user.entity.LearningSessionProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface LearningSessionProgressRepository extends JpaRepository<LearningSessionProgress, Long> {
    Optional<LearningSessionProgress> findByUserIdAndWeekNumberAndSessionIndex(Long userId, int weekNumber, int sessionIndex);

    @Query("SELECT p FROM LearningSessionProgress p WHERE p.user.id = :userId AND p.status = 'COMPLETED' ORDER BY p.weekNumber DESC, p.sessionIndex DESC")
    List<LearningSessionProgress> findCompletedByUserId(Long userId);

    List<LearningSessionProgress> findByUserIdAndStatus(Long userId, LearningSessionProgress.Status status);

    long countByUserIdAndStatus(Long userId, LearningSessionProgress.Status status);

    @Query("SELECT p FROM LearningSessionProgress p WHERE p.user.id = :userId AND p.status = 'COMPLETED' AND p.completedAt IS NOT NULL")
    List<LearningSessionProgress> findCompletedWithTimestampByUserId(Long userId);
}

