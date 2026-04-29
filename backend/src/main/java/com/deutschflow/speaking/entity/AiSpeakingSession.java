package com.deutschflow.speaking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "ai_speaking_sessions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiSpeakingSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "topic", length = 200)
    private String topic;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private SessionStatus status = SessionStatus.ACTIVE;

    @Column(name = "started_at", nullable = false, updatable = false)
    private LocalDateTime startedAt;

    @Column(name = "last_activity_at", nullable = false)
    private LocalDateTime lastActivityAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    @Column(name = "message_count", nullable = false)
    @Builder.Default
    private int messageCount = 0;

    @PrePersist
    void onCreate() {
        var now = LocalDateTime.now();
        if (startedAt == null) startedAt = now;
        if (lastActivityAt == null) lastActivityAt = now;
    }

    public enum SessionStatus {
        ACTIVE, ENDED
    }
}
