package com.deutschflow.user.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "learning_review_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LearningReviewItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "item_type", nullable = false)
    private ItemType itemType;

    @Column(name = "item_ref", nullable = false, length = 128)
    private String itemRef;

    @Column(name = "prompt", nullable = false, columnDefinition = "text")
    private String prompt;

    @Column(name = "repetitions", nullable = false)
    private int repetitions;

    @Column(name = "interval_days", nullable = false)
    private int intervalDays;

    @Column(name = "ease_factor", nullable = false, precision = 4, scale = 2)
    private BigDecimal easeFactor;

    @Column(name = "state", nullable = false)
    private int state;

    @Column(name = "difficulty", nullable = false, precision = 5, scale = 2)
    private BigDecimal difficulty;

    @Column(name = "stability", nullable = false, precision = 8, scale = 4)
    private BigDecimal stability;

    @Column(name = "lapses", nullable = false)
    private int lapses;

    @Column(name = "last_reviewed_state")
    private Integer lastReviewedState;

    @Column(name = "due_at", nullable = false)
    private LocalDateTime dueAt;

    @Column(name = "last_reviewed_at")
    private LocalDateTime lastReviewedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (easeFactor == null) {
            easeFactor = BigDecimal.valueOf(2.5);
        }
        if (difficulty == null) {
            difficulty = BigDecimal.ZERO;
        }
        if (stability == null) {
            stability = BigDecimal.ZERO;
        }
        if (dueAt == null) {
            dueAt = now;
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum ItemType {
        WORD, GRAMMAR
    }
}
