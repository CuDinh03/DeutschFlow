package com.deutschflow.feedback.repository;

import com.deutschflow.feedback.FeedbackEnums.Status;
import com.deutschflow.feedback.entity.FeedbackItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FeedbackItemRepository extends JpaRepository<FeedbackItem, Long> {

    List<FeedbackItem> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<FeedbackItem> findByUserIdAndClientRequestId(Long userId, String clientRequestId);

    long countByStatus(Status status);
}
