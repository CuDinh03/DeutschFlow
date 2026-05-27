package com.deutschflow.vocabulary.repository;

import com.deutschflow.vocabulary.entity.SpacedRepetitionSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface SpacedRepetitionRepository extends JpaRepository<SpacedRepetitionSchedule, Long> {

    Optional<SpacedRepetitionSchedule> findByUserIdAndWordId(Long userId, Long wordId);

    boolean existsByUserIdAndWordId(Long userId, Long wordId);

    @Query("SELECT s FROM SpacedRepetitionSchedule s WHERE s.userId = :userId AND s.nextReviewDate <= :now ORDER BY s.nextReviewDate ASC LIMIT :limit")
    List<SpacedRepetitionSchedule> findDueForReview(@Param("userId") Long userId, @Param("now") LocalDateTime now, @Param("limit") int limit);

    long countByUserId(Long userId);

    long countByUserIdAndRetentionStatus(Long userId, String retentionStatus);

    List<SpacedRepetitionSchedule> findByUserIdOrderByNextReviewDate(Long userId);
}
