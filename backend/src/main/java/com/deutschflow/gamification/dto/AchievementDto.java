package com.deutschflow.gamification.dto;

/**
 * Achievement data for FE badge display.
 */
public record AchievementDto(
        Long id,
        String code,
        String nameVi,
        String descriptionVi,
        String iconEmoji,
        int xpReward,
        String rarity,    // COMMON | RARE | EPIC | LEGENDARY
        boolean unlocked
) {}
