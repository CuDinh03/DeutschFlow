package com.deutschflow.user.dto;

import java.util.List;
import java.util.Map;

public record LearningAnalyticsSummaryDto(
        /**
         * Khoảng thống kê, dạng ISO yyyy-MM-dd theo ngày lịch Việt Nam (xem
         * LearningAnalyticsService.BUSINESS_ZONE). Trả về tường minh để giao diện hiển thị đúng
         * khoảng đang xem thay vì tự suy từ đồng hồ máy khách — máy khách ở múi giờ khác sẽ suy ra
         * một khoảng khác với khoảng dữ liệu thực sự được cộng.
         */
        String rangeStart,
        String rangeEnd,
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
