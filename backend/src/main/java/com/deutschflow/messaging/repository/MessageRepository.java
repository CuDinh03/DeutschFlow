package com.deutschflow.messaging.repository;

import com.deutschflow.messaging.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {

    /** Full thread between two users, oldest → newest. */
    List<Message> findBySenderIdAndRecipientIdOrSenderIdAndRecipientIdOrderByIdAsc(
            Long aSender, Long aRecipient, Long bSender, Long bRecipient);

    /** Most-recent messages involving the user (either side) — grouped into conversations in-service. */
    List<Message> findTop300BySenderIdOrRecipientIdOrderByIdDesc(Long sender, Long recipient);

    /** Total unread across all threads for a recipient (conversation-list badge). */
    long countByRecipientIdAndReadAtIsNull(Long recipientId);

    /** Marks every unread message FROM {@code otherId} TO {@code me} as read; returns rows updated. */
    @Modifying(clearAutomatically = true)
    @Query("""
            UPDATE Message m SET m.readAt = :now
            WHERE m.recipientId = :me AND m.senderId = :otherId AND m.readAt IS NULL
            """)
    int markThreadRead(@Param("me") Long me, @Param("otherId") Long otherId, @Param("now") Instant now);
}
