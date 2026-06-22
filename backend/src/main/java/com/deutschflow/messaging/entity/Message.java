package com.deutschflow.messaging.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * A direct 1-1 message between two users (student ↔ teacher). A "conversation" is the
 * {@code (senderId, recipientId)} pair, derived at read time — there is no conversation table.
 *
 * <p>Who-may-message-whom (shared teacher↔student class) is enforced in {@code MessageService},
 * not here; this entity only stores the thread + read state.
 */
@Entity
@Table(name = "messages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sender_id", nullable = false)
    private Long senderId;

    @Column(name = "recipient_id", nullable = false)
    private Long recipientId;

    @Column(nullable = false)
    private String body;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "read_at")
    private Instant readAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
