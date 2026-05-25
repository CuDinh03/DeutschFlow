package com.deutschflow.gamification.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * Achievement definition (seeded via Flyway V58).
 * Read-only at runtime — only Flyway migrations update these rows.
 */
@Entity
@Table(name = "achievements")
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Achievement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String code;

    @Column(name = "name_vi", nullable = false, length = 128)
    private String nameVi;

    @Column(name = "description_vi", nullable = false)
    private String descriptionVi;

    @Column(name = "icon_emoji", length = 8)
    @Builder.Default
    private String iconEmoji = "🏆";

    @Column(name = "xp_reward", nullable = false)
    private int xpReward;

    @Column(name = "trigger_type", nullable = false, length = 64)
    private String triggerType;

    @Column(name = "trigger_threshold", nullable = false)
    private int triggerThreshold;

    @Column(name = "rarity", nullable = false, length = 16)
    @Builder.Default
    private String rarity = "COMMON";
}
