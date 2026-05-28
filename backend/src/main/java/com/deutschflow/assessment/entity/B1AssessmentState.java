package com.deutschflow.assessment.entity;

import com.deutschflow.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "b1_assessment_states")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class B1AssessmentState {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "vocabulary_check_passed", nullable = false)
    @Builder.Default
    private boolean vocabularyCheckPassed = false;

    @Column(name = "speaking_check_passed", nullable = false)
    @Builder.Default
    private boolean speakingCheckPassed = false;

    @Column(name = "grammar_check_passed", nullable = false)
    @Builder.Default
    private boolean grammarCheckPassed = false;

    @Column(name = "confidence_check_passed", nullable = false)
    @Builder.Default
    private boolean confidenceCheckPassed = false;

    @Column(name = "mock_exam_passed", nullable = false)
    @Builder.Default
    private boolean mockExamPassed = false;

    @Column(name = "readiness_score", nullable = false)
    @Builder.Default
    private int readinessScore = 0;

    @Column(name = "last_assessment_at")
    private LocalDateTime lastAssessmentAt;

    @Column(name = "graduation_confirmed_at")
    private LocalDateTime graduationConfirmedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        var now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public boolean isFullyReady() {
        return vocabularyCheckPassed && speakingCheckPassed
                && grammarCheckPassed && confidenceCheckPassed && mockExamPassed;
    }
}
