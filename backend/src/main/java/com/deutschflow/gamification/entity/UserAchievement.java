package com.deutschflow.gamification.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Records when a user unlocks an achievement.
 * {@code notified=false} means the FE badge toast has not been shown yet.
 */
@Entity
@Table(name = "user_achievements",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "achievement_id"}))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserAchievement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "achievement_id", nullable = false)
    private Achievement achievement;

    @Column(name = "unlocked_at", nullable = false)
    @Builder.Default
    private LocalDateTime unlockedAt = LocalDateTime.now();

    /** False = FE has not yet shown the badge toast. */
    @Column(name = "notified", nullable = false)
    @Builder.Default
    private boolean notified = false;
}
