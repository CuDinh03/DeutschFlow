package com.deutschflow.user.dto;

import java.util.Map;

public record LearningPlanResponse(
        int weeklyMinutes,
        int weeksTotal,
        int sessionsPerWeek,
        int minutesPerSession,
        Map<String, Object> plan
) {}

