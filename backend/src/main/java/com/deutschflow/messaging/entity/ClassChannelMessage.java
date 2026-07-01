package com.deutschflow.messaging.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * A message in a class's group channel (P6). Every class member (enrolled students + the
 * class's teachers) may post and read. Distinct from {@link Message} (1-1) — this is scoped
 * to a {@code classId} and fanned out to all members.
 *
 * <p>Deletion is SOFT: {@code deletedAt}/{@code deletedBy} are set but the row + original body
 * are retained as an audit trail for the teacher. Membership + who-may-delete is enforced in
 * {@code ClassChannelService}.
 */
@Entity
@Table(name = "class_channel_messages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassChannelMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "class_id", nullable = false)
    private Long classId;

    @Column(name = "sender_id", nullable = false)
    private Long senderId;

    @Column(nullable = false)
    private String body;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Column(name = "deleted_by")
    private Long deletedBy;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
