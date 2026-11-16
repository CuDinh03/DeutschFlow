package com.deutschflow.feedback.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** Ảnh chụp màn hình của một góp ý (V389). File nằm ở tiền tố `feedback/`, chỉ mở qua URL ký (FBK-19). */
@Entity
@Table(name = "feedback_attachments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FeedbackAttachment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** NULL tới khi gắn vào góp ý. */
    @Column(name = "feedback_id")
    private Long feedbackId;

    @Column(name = "uploader_id", nullable = false)
    private Long uploaderId;

    @Column(name = "object_key", nullable = false, length = 255, unique = true)
    private String objectKey;

    @Column(name = "content_type", nullable = false, length = 32)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private int sizeBytes;

    @Column(nullable = false)
    private int width;

    @Column(nullable = false)
    private int height;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "purged_at")
    private Instant purgedAt;
}
