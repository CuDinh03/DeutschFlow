package com.deutschflow.teacher.dto;

import java.util.List;

public record ClassAnalyticsOverviewDto(
        Long totalStudents,
        Long totalXp,
        Long completedAssignments,
        Long activeSpeakingSessions,
        Double avgSpeakingScore,
        Double reviewCoveragePct,
        List<ClassErrorAnalyticsDto> topErrors,
        List<ActionItemDto> actionItems
) {
    public record ActionItemDto(String title, String detail, String priority, String href) {}
}
