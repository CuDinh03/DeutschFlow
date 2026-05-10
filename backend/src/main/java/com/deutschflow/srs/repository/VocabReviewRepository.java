package com.deutschflow.srs.repository;

import com.deutschflow.srs.entity.VocabReviewSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface VocabReviewRepository extends JpaRepository<VocabReviewSchedule, Long> {

    Optional<VocabReviewSchedule> findByUserIdAndVocabId(Long userId, String vocabId);

    /** Cards due for review (next_review_at <= now), max 10 */
    @Query("""
        SELECT v FROM VocabReviewSchedule v
        WHERE v.userId = :userId
          AND v.nextReviewAt <= :now
        ORDER BY v.nextReviewAt ASC
        LIMIT 10
    """)
    List<VocabReviewSchedule> findDueCards(@Param("userId") Long userId,
                                            @Param("now") OffsetDateTime now);

    /** Count of due cards (for badge in UI) */
    @Query("""
        SELECT COUNT(v) FROM VocabReviewSchedule v
        WHERE v.userId = :userId
          AND v.nextReviewAt <= :now
    """)
    long countDue(@Param("userId") Long userId, @Param("now") OffsetDateTime now);

    /** All cards for a user (for stats) */
    List<VocabReviewSchedule> findByUserIdOrderByNextReviewAtAsc(Long userId);

    long countByUserId(Long userId);
}
