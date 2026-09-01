package com.deutschflow.notification.entity;

import com.deutschflow.notification.NotificationType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Outbox thông báo bền vững (V294, G2): dòng được GHI trong giao dịch nghiệp vụ (áp lịch đã duyệt)
 * — giao dịch rollback thì không tồn tại; worker {@code NotificationOutboxWorker} gửi sau commit,
 * retry khi lỗi. {@code dedupKey} UNIQUE ("request:{id}:v{version}:u{userId}") chặn gửi trùng theo
 * (đề xuất, phiên bản, người nhận) kể cả khi worker chạy lại.
 */
@Entity
@Table(name = "notification_outbox")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationOutbox {

    public enum Status { PENDING, SENT, FAILED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "dedup_key", nullable = false, length = 128, unique = true)
    private String dedupKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "notification_type", nullable = false, length = 64)
    private NotificationType notificationType;

    @Column(name = "class_id")
    private Long classId;

    @Column(name = "recipient_id", nullable = false)
    private Long recipientId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> payload = new HashMap<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private Status status = Status.PENDING;

    @Column(nullable = false)
    @Builder.Default
    private int attempts = 0;

    @Column(name = "next_attempt_at", nullable = false)
    private LocalDateTime nextAttemptAt;

    @Column(name = "last_error", columnDefinition = "text")
    private String lastError;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (nextAttemptAt == null) nextAttemptAt = createdAt;
    }
}
