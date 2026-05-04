package com.deutschflow.speaking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "speaking_turn_evaluation")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SpeakingTurnEvaluation {

    @Id
    @Column(name = "turn_id", nullable = false)
    private Long turnId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @Column(name = "error_count", nullable = false)
    @Builder.Default
    private int errorCount = 0;

    @Column(name = "major_plus_count", nullable = false)
    @Builder.Default
    private int majorPlusCount = 0;

    @Column(name = "focus_hit", nullable = false)
    @Builder.Default
    private boolean focusHit = false;

    @Column(name = "difficulty_at_turn", nullable = false)
    @Builder.Default
    private short difficultyAtTurn = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
