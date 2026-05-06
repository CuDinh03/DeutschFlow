package com.deutschflow.gamification.dto;

/**
 * A single row in the XP leaderboard.
 *
 * @param rank        1-based rank position
 * @param userId      user ID (for frontend highlight of "my rank")
 * @param displayName user's public display name (no email exposed)
 * @param totalXp     accumulated XP across all events
 * @param level       computed level from totalXp
 */
public record LeaderboardDto(
        int rank,
        Long userId,
        String displayName,
        long totalXp,
        int level
) {}
