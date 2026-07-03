package com.deutschflow.moderation.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * A user-filed report of objectionable content or an abusive user, triaged by admins. The reported
 * message id is stored WITHOUT a foreign key (the message may be deleted); {@code snapshotBody}
 * preserves the reported text for moderation even after deletion.
 */
@Entity
@Table(name = "content_reports")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContentReport {

    /** What was reported. */
    public enum Context { DIRECT_MESSAGE, CLASS_MESSAGE, USER }

    /** Why it was reported. */
    public enum Reason { HARASSMENT, SEXUAL, HATE, SPAM, OTHER }

    /** Moderation state. */
    public enum Status { PENDING, RESOLVED, DISMISSED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "reporter_id", nullable = false)
    private Long reporterId;

    @Column(name = "reported_user_id")
    private Long reportedUserId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private Context context;

    @Column(name = "message_id")
    private Long messageId;

    @Column(name = "class_message_id")
    private Long classMessageId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Reason reason;

    @Column(length = 1000)
    private String details;

    @Column(name = "snapshot_body", length = 8000)
    private String snapshotBody;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Column(name = "resolved_by")
    private Long resolvedBy;
}
