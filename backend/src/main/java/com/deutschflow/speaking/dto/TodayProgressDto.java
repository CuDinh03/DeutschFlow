package com.deutschflow.speaking.dto;

public record TodayProgressDto(
        double rollingAccuracyPercent,
        int streakDays,
        String topWeakErrorCode
) {
}
