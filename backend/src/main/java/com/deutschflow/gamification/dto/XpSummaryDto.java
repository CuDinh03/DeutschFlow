package com.deutschflow.gamification.dto;

import java.util.List;

/**
 * Full XP profile for a user — returned by GET /api/xp/me
 */
public record XpSummaryDto(
        Long userId,
        int totalXp,
        int level,
        int progressInLevel,  // XP earned since current level started
        int xpNeededForNext,  // XP needed to reach next level
        List<AchievementDto> allAchievements,
        List<AchievementDto> pendingBadges    // Unlocked but not yet shown to user
) {}
