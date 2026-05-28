package com.deutschflow.user.repository;

import com.deutschflow.user.entity.LearningAnalytics;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface LearningAnalyticsRepository extends JpaRepository<LearningAnalytics, Long> {

    Optional<LearningAnalytics> findByUserIdAndAnalyticsDate(Long userId, LocalDate date);

    List<LearningAnalytics> findByUserIdAndAnalyticsDateBetweenOrderByAnalyticsDateAsc(
            Long userId, LocalDate from, LocalDate to);

    @Query("""
            SELECT SUM(a.wordsLearned) FROM LearningAnalytics a
            WHERE a.userId = :userId AND a.analyticsDate >= :from
            """)
    Long sumWordsLearnedSince(@Param("userId") Long userId, @Param("from") LocalDate from);

    @Query("""
            SELECT SUM(a.speakingMinutes) FROM LearningAnalytics a
            WHERE a.userId = :userId AND a.analyticsDate >= :from
            """)
    Long sumSpeakingMinutesSince(@Param("userId") Long userId, @Param("from") LocalDate from);
}
