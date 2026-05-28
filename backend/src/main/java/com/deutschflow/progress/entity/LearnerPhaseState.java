package com.deutschflow.progress.entity;

import com.deutschflow.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "learner_phase_states")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LearnerPhaseState {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "current_phase", nullable = false)
    @Builder.Default
    private PhaseType currentPhase = PhaseType.FOUNDATION;

    @Column(name = "phase_started_at", nullable = false)
    private LocalDateTime phaseStartedAt;

    @Column(name = "foundation_completed_at")
    private LocalDateTime foundationCompletedAt;

    @Column(name = "production_completed_at")
    private LocalDateTime productionCompletedAt;

    @Column(name = "fluency_completed_at")
    private LocalDateTime fluencyCompletedAt;

    @Column(name = "graduated_at")
    private LocalDateTime graduatedAt;

    @Column(name = "vocabulary_mastered_count", nullable = false)
    @Builder.Default
    private int vocabularyMasteredCount = 0;

    @Column(name = "speaking_minutes_total", nullable = false)
    @Builder.Default
    private int speakingMinutesTotal = 0;

    @Column(name = "grammar_accuracy_percent", nullable = false)
    @Builder.Default
    private int grammarAccuracyPercent = 0;

    @Column(name = "sessions_completed", nullable = false)
    @Builder.Default
    private int sessionsCompleted = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        var now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (phaseStartedAt == null) {
            phaseStartedAt = now;
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
