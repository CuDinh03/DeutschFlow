package com.deutschflow.feedback.repository;

import com.deutschflow.feedback.entity.FeedbackAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface FeedbackAttachmentRepository extends JpaRepository<FeedbackAttachment, Long> {

    List<FeedbackAttachment> findByFeedbackIdOrderByIdAsc(Long feedbackId);

    List<FeedbackAttachment> findByFeedbackIdIn(Collection<Long> feedbackIds);

    List<FeedbackAttachment> findByIdInAndUploaderId(Collection<Long> ids, Long uploaderId);

    @Modifying
    @Query("update FeedbackAttachment a set a.feedbackId = :feedbackId "
            + "where a.id in :ids and a.uploaderId = :uploaderId and a.feedbackId is null")
    int attachUnattached(@Param("feedbackId") Long feedbackId, @Param("ids") Collection<Long> ids,
                         @Param("uploaderId") Long uploaderId);

    @Query("select a.objectKey from FeedbackAttachment a where a.uploaderId = :userId and a.purgedAt is null")
    List<String> findLiveObjectKeysByUploader(@Param("userId") Long userId);
}
