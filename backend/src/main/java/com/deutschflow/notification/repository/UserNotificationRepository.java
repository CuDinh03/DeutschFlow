package com.deutschflow.notification.repository;

import com.deutschflow.notification.entity.UserNotification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;

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

    /**
     * Đánh dấu đã đọc theo NGỮ CẢNH: mọi thông báo chưa đọc của {@code userId}, thuộc {@code types},
     * có {@code payload_json} CHỨA {@code matchJson} (jsonb containment {@code @>}). Native query vì
     * dùng toán tử jsonb của Postgres. Lọc {@code recipient_user_id + read_at IS NULL} trước → trúng
     * index bộ phận {@code idx_user_notifications_recipient_unread}, nên rẻ dù không có GIN index.
     *
     * @param matchJson chuỗi JSON hợp lệ (được cast sang jsonb); tham số hoá, không nối chuỗi tay.
     */
    @Modifying
    @Query(value = """
            UPDATE user_notifications
               SET read_at = :readAt
             WHERE recipient_user_id = :userId
               AND read_at IS NULL
               AND notification_type IN (:types)
               AND payload_json @> CAST(:matchJson AS jsonb)
            """, nativeQuery = true)
    int markReadByContext(@Param("userId") long userId,
                          @Param("types") Collection<String> types,
                          @Param("matchJson") String matchJson,
                          @Param("readAt") LocalDateTime readAt);

    /**
     * Đánh dấu đã đọc theo TYPE (không lọc payload): mọi thông báo chưa đọc của {@code userId} thuộc
     * {@code types}. Dùng cho loại nên đọc bất kể payload (ví dụ nhắc ôn tập khi đã học trong ngày).
     */
    @Modifying
    @Query(value = """
            UPDATE user_notifications
               SET read_at = :readAt
             WHERE recipient_user_id = :userId
               AND read_at IS NULL
               AND notification_type IN (:types)
            """, nativeQuery = true)
    int markReadByType(@Param("userId") long userId,
                       @Param("types") Collection<String> types,
                       @Param("readAt") LocalDateTime readAt);
}
