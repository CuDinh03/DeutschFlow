package com.deutschflow.user.dto;

/**
 * Stats payload for the mobile /api/student/stats endpoint.
 * weeklyProgress: 7 elements, minutes studied per day Mon–Sun of the current ISO week.
 */
public record StudentStatsResponse(
        int streakDays,
        long totalXp,
        int xpLevel,
        int wordsLearned,
        int speakingMinutes,
        int grammarAccuracy,
        int[] weeklyProgress
) {}
