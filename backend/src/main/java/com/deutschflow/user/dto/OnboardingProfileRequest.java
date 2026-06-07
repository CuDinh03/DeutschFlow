package com.deutschflow.user.dto;

import jakarta.validation.constraints.*;

import java.util.List;

public record OnboardingProfileRequest(
        @NotBlank(message = "goalType is required")
        String goalType,

        @NotBlank(message = "targetLevel is required")
        String targetLevel,

        String currentLevel,

        String ageRange,

        List<@NotBlank(message = "interest must not be blank") String> interests,

        @Size(max = 100, message = "industry must be <= 100 characters")
        String industry,

        List<@NotBlank(message = "workUseCase must not be blank") String> workUseCases,

        @Size(max = 50, message = "examType must be <= 50 characters")
        String examType,

        @Min(value = 1, message = "sessionsPerWeek must be >= 1")
        @Max(value = 14, message = "sessionsPerWeek must be <= 14")
        Integer sessionsPerWeek,

        @Min(value = 5, message = "minutesPerSession must be >= 5")
        @Max(value = 180, message = "minutesPerSession must be <= 180")
        Integer minutesPerSession,

        String learningSpeed,

        /** Onboarding "why are you learning?" — JOB/AUSBILDUNG/STUDY/IMMIGRATION/EXAM/HOBBY. Optional. */
        String motivation,

        /** Daily study-goal in minutes (e.g. 5/10/15/20) — the streak anchor. Optional. */
        @Min(value = 5, message = "dailyGoalMinutes must be >= 5")
        @Max(value = 120, message = "dailyGoalMinutes must be <= 120")
        Integer dailyGoalMinutes
) {}

