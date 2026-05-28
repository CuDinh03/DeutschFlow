package com.deutschflow.user.dto;

import java.util.List;
import java.util.Map;

public record LearningAnalyticsSummaryDto(
        int totalWordsLearned,
        int totalWordsReviewed,
        int totalSpeakingMinutes,
        int totalSessionsCompleted,
        long wordsDueForReview,
        List<DayStatsDto> weeklyBreakdown,
        Map<String, Long> errorsByType,
        List<String> topWeakPoints
) {
    public record DayStatsDto(
            String date,
            int wordsLearned,
            int wordsReviewed,
            int speakingMinutes
    ) {}
}
