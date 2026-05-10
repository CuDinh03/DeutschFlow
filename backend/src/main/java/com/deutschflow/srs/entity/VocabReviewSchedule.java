package com.deutschflow.srs.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Spaced Repetition Schedule entry per user/vocab (SM-2 algorithm).
 */
@Entity
@Table(name = "vocab_review_schedule",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "vocab_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VocabReviewSchedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "node_id")
    private Long nodeId;

    /** Stable identifier for the vocab item (e.g. "sg01_01" or hash) */
    @Column(name = "vocab_id", nullable = false, length = 80)
    private String vocabId;

    @Column(nullable = false)
    private String german;

    @Column(nullable = false)
    private String meaning;

    @Column(name = "example_de")
    private String exampleDe;

    @Column(name = "speak_de")
    private String speakDe;

    // ─── SM-2 fields ──────────────────────────────────────────────────────────

    /** SM-2 ease factor (starts at 2.5, min 1.3) */
    @Column(name = "ease_factor", nullable = false, precision = 4, scale = 2)
    @Builder.Default
    private BigDecimal easeFactor = new BigDecimal("2.50");

    /** Days until next review */
    @Column(name = "interval_days", nullable = false)
    @Builder.Default
    private int intervalDays = 1;

    /** Successful repetitions in a row */
    @Column(nullable = false)
    @Builder.Default
    private int repetitions = 0;

    /** When this card is due for review */
    @Column(name = "next_review_at", nullable = false)
    @Builder.Default
    private OffsetDateTime nextReviewAt = OffsetDateTime.now();

    @Column(name = "last_review_at")
    private OffsetDateTime lastReviewAt;

    /** Last SM-2 quality rating (0-5) */
    @Column(name = "last_quality")
    private Short lastQuality;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
