package com.deutschflow.notification.repository;

import com.deutschflow.notification.entity.UserNotification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;

public interface UserNotificationRepository extends JpaRepository<UserNotification, Long> {

    Page<UserNotification> findByRecipient_IdAndReadAtIsNullOrderByIdDesc(Long recipientId, Pageable pageable);

    Page<UserNotification> findByRecipient_IdOrderByIdDesc(Long recipientId, Pageable pageable);

    long countByRecipient_IdAndReadAtIsNull(Long recipientId);

    @Modifying
    @Query("UPDATE UserNotification n SET n.readAt = :readAt WHERE n.recipient.id = :userId AND n.id = :id AND n.readAt IS NULL")
    int markOneRead(@Param("userId") Long userId, @Param("id") Long id, @Param("readAt") LocalDateTime readAt);

    @Modifying
    @Query("UPDATE UserNotification n SET n.readAt = :readAt WHERE n.recipient.id = :userId AND n.readAt IS NULL")
    int markAllReadForUser(@Param("userId") Long userId, @Param("readAt") LocalDateTime readAt);

    @Modifying
    @Query("DELETE FROM UserNotification n WHERE n.readAt IS NOT NULL AND n.readAt < :cutoff")
    int deleteByReadAtIsNotNullAndReadAtBefore(@Param("cutoff") LocalDateTime cutoff);
}
