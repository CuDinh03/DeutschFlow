package com.deutschflow.user.dto;

import java.util.List;

/**
 * Full learning profile response for the settings page pre-fill.
 */
public record LearningProfileResponse(
        String goalType,
        String targetLevel,
        String currentLevel,
        String industry,
        List<String> interests,
        String learningSpeed,
        Integer sessionsPerWeek,
        Integer minutesPerSession,
        String examType,
        String ageRange
) {}
