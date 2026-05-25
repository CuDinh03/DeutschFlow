package com.deutschflow.srs.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Spaced Repetition Schedule entry per user/vocab.
 *
 * <p>Supports two algorithms via {@link #algorithmVersion}:
 * <ul>
 *   <li>{@code SM2} — SuperMemo-2 legacy (ease_factor, interval_days, repetitions)</li>
 *   <li>{@code FSRS} — FSRS-4.5 (stability, difficulty, retrievability, fsrs_state)</li>
 * </ul>
 *
 * <p><b>Migrate-on-Read strategy:</b> existing SM-2 cards keep their data unchanged.
 * When a user reviews an SM-2 card, {@code SrsService} transparently upgrades it
 * to FSRS and sets {@code algorithmVersion = FSRS}. New cards start as FSRS directly.
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

    // ─── Identity ─────────────────────────────────────────────────────────────

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "node_id")
    private Long nodeId;

    /** Stable identifier for the vocab item (e.g. "sg01_01") */
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

    // ─── Algorithm routing ────────────────────────────────────────────────────

    /**
     * Indicates which SRS algorithm is managing this card.
     * Default SM2 for existing cards; upgraded to FSRS on first review after V138.
     */
    @Column(name = "algorithm_version", nullable = false, length = 10)
    @Builder.Default
    private String algorithmVersion = AlgorithmVersion.SM2.name();

    // ─── SM-2 fields (preserved — never overwritten when FSRS takes over) ────

    /** SM-2 ease factor (starts at 2.5, min 1.3) */
    @Column(name = "ease_factor", nullable = false, precision = 4, scale = 2)
    @Builder.Default
    private BigDecimal easeFactor = new BigDecimal("2.50");

    /** Days until next review (SM-2) */
    @Column(name = "interval_days", nullable = false)
    @Builder.Default
    private int intervalDays = 1;

    /** Successful repetitions in a row (SM-2) */
    @Column(nullable = false)
    @Builder.Default
    private int repetitions = 0;

    /** Last SM-2 quality rating (0-5) */
    @Column(name = "last_quality")
    private Short lastQuality;

    // ─── FSRS-4.5 fields ─────────────────────────────────────────────────────

    /**
     * FSRS state machine: New(0) → Learning(1) → Review(2) / Relearning(3).
     * Stored as smallint to match V131 convention.
     */
    @Column(name = "fsrs_state", nullable = false)
    @Builder.Default
    private short fsrsState = FsrsState.NEW.value;

    /**
     * FSRS Stability (S): days until retrievability R drops to 0.9.
     * Null for cards not yet upgraded to FSRS.
     */
    @Column(name = "stability", precision = 10, scale = 4)
    private BigDecimal stability;

    /**
     * FSRS Difficulty (D): intrinsic difficulty of this card (1.0 easy – 10.0 hard).
     * Initialized to 5.0 (medium) on first FSRS review.
     */
    @Column(name = "difficulty", precision = 4, scale = 2)
    private BigDecimal difficulty;

    /**
     * FSRS Retrievability (R): probability of successful recall at the moment of last review (0–1).
     * Stored for analytics / dashboard display; recomputed from S on each review.
     */
    @Column(name = "retrievability", precision = 6, scale = 4)
    private BigDecimal retrievability;

    // ─── Shared scheduling field ──────────────────────────────────────────────

    /** When this card is next due — used by BOTH SM-2 and FSRS */
    @Column(name = "next_review_at", nullable = false)
    @Builder.Default
    private OffsetDateTime nextReviewAt = OffsetDateTime.now();

    @Column(name = "last_review_at")
    private OffsetDateTime lastReviewAt;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private OffsetDateTime createdAt = OffsetDateTime.now();

    // ─── Enums ────────────────────────────────────────────────────────────────

    /** Which scheduling algorithm is active for this card. */
    public enum AlgorithmVersion {
        SM2, FSRS
    }

    /** FSRS-4.5 card state machine values. */
    public enum FsrsState {
        NEW(0), LEARNING(1), REVIEW(2), RELEARNING(3);

        public final short value;
        FsrsState(int v) { this.value = (short) v; }
    }
}
