package com.deutschflow.user.dto;

import java.util.Map;

public record LearningPlanResponse(
        int weeklyMinutes,
        int weeksTotal,
        Map<String, Object> plan
) {}

