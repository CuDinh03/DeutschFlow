package com.deutschflow.user.repository;

import com.deutschflow.user.entity.LearningReviewItem;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface LearningReviewItemRepository extends JpaRepository<LearningReviewItem, Long> {

    List<LearningReviewItem> findByUserIdAndDueAtLessThanEqualOrderByDueAtAsc(
            Long userId,
            LocalDateTime dueAt,
            Pageable pageable
    );

    List<LearningReviewItem> findByUserIdAndItemTypeAndDueAtLessThanEqualOrderByDueAtAsc(
            Long userId,
            LearningReviewItem.ItemType itemType,
            LocalDateTime dueAt,
            Pageable pageable
    );

    Optional<LearningReviewItem> findByIdAndUserId(Long id, Long userId);

    long countByUserId(Long userId);
}
