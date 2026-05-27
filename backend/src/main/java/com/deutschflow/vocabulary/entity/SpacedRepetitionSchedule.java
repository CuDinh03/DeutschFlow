package com.deutschflow.vocabulary.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Spaced Repetition Schedule Entity - tracks learning schedule using SM-2 algorithm
 */
@Entity
@Table(name = "spaced_repetition_schedule", indexes = {
        @Index(name = "idx_srs_user_next_review", columnList = "user_id, next_review_date"),
        @Index(name = "idx_srs_user_retention", columnList = "user_id, retention_status"),
        @Index(name = "idx_srs_word_id", columnList = "word_id")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SpacedRepetitionSchedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "word_id", nullable = false)
    private Long wordId;

    @Column(name = "last_review_date")
    private LocalDateTime lastReviewDate;

    @Column(name = "next_review_date", nullable = false)
    private LocalDateTime nextReviewDate;

    @Column(name = "review_count", nullable = false)
    @Builder.Default
    private Integer reviewCount = 0;

    @Column(name = "easiness_factor", nullable = false)
    @Builder.Default
    private Double easinessFactor = 2.5;

    @Column(name = "interval", nullable = false)
    @Builder.Default
    private Integer interval = 1;

    @Column(name = "retention_status", nullable = false)
    @Builder.Default
    private String retentionStatus = "LEARNING"; // LEARNING, REVIEWING, MASTERED

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public boolean isDueForReview() {
        return nextReviewDate.isBefore(LocalDateTime.now());
    }
}
