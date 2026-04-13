package com.deutschflow.user.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "learning_plans")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LearningPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "profile_id", nullable = false)
    private UserLearningProfile profile;

    @Enumerated(EnumType.STRING)
    @Column(name = "goal_type", nullable = false)
    private UserLearningProfile.GoalType goalType;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_level", nullable = false)
    private UserLearningProfile.TargetLevel targetLevel;

    @Enumerated(EnumType.STRING)
    @Column(name = "current_level", nullable = false)
    private UserLearningProfile.CurrentLevel currentLevel;

    @Column(name = "sessions_per_week", nullable = false)
    private int sessionsPerWeek;

    @Column(name = "minutes_per_session", nullable = false)
    private int minutesPerSession;

    @Column(name = "weekly_minutes", nullable = false)
    private int weeklyMinutes;

    @Column(name = "weeks_total", nullable = false)
    private int weeksTotal;

    @Column(name = "plan_json", nullable = false, columnDefinition = "json")
    private String planJson;

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
}

