package com.deutschflow.teacher.dto;

import java.util.List;

public record ClassAnalyticsOverviewDto(
        Long totalStudents,
        Long totalXp,
        Long completedAssignments,
        List<ClassErrorAnalyticsDto> topErrors
) {}
