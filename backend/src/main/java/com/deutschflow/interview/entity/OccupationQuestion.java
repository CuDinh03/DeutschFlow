package com.deutschflow.interview.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Một câu hỏi thuộc lớp nghề (V335, đợt 2b A + B + E). {@code id} dạng {@code occ_<mã nghề>_<hậu tố>}
 * để {@link com.deutschflow.speaking.interview.InterviewSessionState#getAskedQuestionIds()} phân biệt
 * được với câu của nhân vật.
 */
@Entity
@Table(name = "occupation_question")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OccupationQuestion {

    public static final String ID_PREFIX = "occ_";

    @Id
    @Column(name = "id", length = 100)
    private String id;

    @Column(name = "occupation_code", nullable = false, length = 64)
    private String occupationCode;

    @Column(name = "phase", nullable = false, length = 30)
    @Builder.Default
    private String phase = "HARD_SKILLS";

    @Column(name = "topic_key", nullable = false, length = 80)
    private String topicKey;

    @Column(name = "question_de", nullable = false, columnDefinition = "TEXT")
    private String questionDe;

    /** Bản dịch tiếng Việt (V339); {@code null} = chưa dịch. */
    @Column(name = "question_vi", columnDefinition = "TEXT")
    private String questionVi;

    /** Bản dịch tiếng Anh (V339); {@code null} = chưa dịch. */
    @Column(name = "question_en", columnDefinition = "TEXT")
    private String questionEn;

    @Column(name = "difficulty", nullable = false, length = 20)
    @Builder.Default
    private String difficulty = "INTERMEDIATE";

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
