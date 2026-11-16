package com.deutschflow.feedback.repository;

import com.deutschflow.feedback.entity.FeedbackReply;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface FeedbackReplyRepository extends JpaRepository<FeedbackReply, Long> {

    List<FeedbackReply> findByFeedbackIdOrderByCreatedAtAsc(Long feedbackId);

    List<FeedbackReply> findByFeedbackIdInOrderByCreatedAtAsc(Collection<Long> feedbackIds);
}
