package com.deutschflow.speaking.dto;

import java.time.LocalDateTime;
import java.util.List;

public record TodayPlanDto(
        List<DueRepairTaskDto> dueRepairTasks,
        TodayRecommendedDto recommendedSpeaking,
        /** Weekly themed assignment (distinct from casual AI chat). May be same cefr/topic hints as adaptive policy. */
        TodayRecommendedDto recommendedWeeklySpeaking,
        TodayRecommendedDto recommendedVocabPractice,
        TodayProgressDto progress
) {
    public record DueRepairTaskDto(
            long id,
            String errorCode,
            String taskType,
            LocalDateTime dueAt,
            int intervalDays
    ) {
    }
}
