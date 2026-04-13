package com.deutschflow.user.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_learning_profiles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserLearningProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "goal_type", nullable = false)
    private GoalType goalType;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_level", nullable = false)
    private TargetLevel targetLevel;

    @Enumerated(EnumType.STRING)
    @Column(name = "current_level", nullable = false)
    @Builder.Default
    private CurrentLevel currentLevel = CurrentLevel.A0;

    @Enumerated(EnumType.STRING)
    @Column(name = "age_range")
    private AgeRange ageRange;

    @Column(name = "interests_json", columnDefinition = "json")
    private String interestsJson;

    @Column(name = "industry", length = 100)
    private String industry;

    @Column(name = "work_use_cases_json", columnDefinition = "json")
    private String workUseCasesJson;

    @Column(name = "exam_type", length = 50)
    private String examType;

    @Column(name = "sessions_per_week", nullable = false)
    private int sessionsPerWeek;

    @Column(name = "minutes_per_session", nullable = false)
    private int minutesPerSession;

    @Enumerated(EnumType.STRING)
    @Column(name = "learning_speed", nullable = false)
    @Builder.Default
    private LearningSpeed learningSpeed = LearningSpeed.NORMAL;

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

    public enum GoalType { WORK, CERT }
    public enum TargetLevel { A1, A2, B1, B2, C1, C2 }
    public enum CurrentLevel { A0, A1, A2, B1, B2, C1, C2 }
    public enum AgeRange { UNDER_18, AGE_18_24, AGE_25_34, AGE_35_44, AGE_45_PLUS }
    public enum LearningSpeed { SLOW, NORMAL, FAST }
}

