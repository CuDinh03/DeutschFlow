package com.deutschflow.grammar.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * A curated, subscription-gated bundle of mock exams (checklist D3). The pack's exams are the
 * active {@code mock_exams} matching its {@code cefrLevel} + {@code examFormat}. {@code requiresPaid}
 * packs are locked for FREE users and unlocked by any paid plan.
 */
@Entity
@Table(name = "mock_exam_packs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MockExamPack {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(name = "description_vi", columnDefinition = "text")
    private String descriptionVi;

    @Column(name = "cefr_level", nullable = false, length = 5)
    private String cefrLevel;

    @Column(name = "exam_format", nullable = false, length = 30)
    @Builder.Default
    private String examFormat = "GOETHE";

    @Column(name = "requires_paid", nullable = false)
    @Builder.Default
    private boolean requiresPaid = true;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private int sortOrder = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
