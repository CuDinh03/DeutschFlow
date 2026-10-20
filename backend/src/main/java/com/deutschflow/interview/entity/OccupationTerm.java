package com.deutschflow.interview.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/** Một từ chuyên môn của nghề (V335, đợt 2b A + B + E) — 6 từ mỗi nghề, cùng luồng duyệt với câu hỏi. */
@Entity
@Table(name = "occupation_term")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OccupationTerm {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "occupation_code", nullable = false, length = 64)
    private String occupationCode;

    @Column(name = "term_de", nullable = false, length = 120)
    private String termDe;

    @Column(name = "meaning_en", nullable = false, length = 200)
    private String meaningEn;

    @Column(name = "meaning_vi", nullable = false, length = 200)
    private String meaningVi;

    @Column(name = "example_de", length = 300)
    private String exampleDe;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private OccupationContentStatus status = OccupationContentStatus.AI_GENERATED;

    @Column(name = "source_model", length = 80)
    private String sourceModel;

    @Column(name = "reviewed_by")
    private Long reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "review_note", length = 500)
    private String reviewNote;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
