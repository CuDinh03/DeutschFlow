package com.deutschflow.curriculum.dto;

import com.deutschflow.user.entity.UserLearningProfile;

import java.util.List;

public record RoadmapSetupRequest(
        String goalType,
        String currentLevel,
        String targetLevel,
        Integer sessionsPerWeek,
        Integer minutesPerSession,
        String learningSpeed,
        String industry,
        List<String> focusAreas,
        String examType
) {
    public UserLearningProfile.CurrentLevel resolveCurrentLevel() {
        if (currentLevel == null || currentLevel.isBlank()) {
            return UserLearningProfile.CurrentLevel.A0;
        }
        return UserLearningProfile.CurrentLevel.valueOf(currentLevel);
    }

    public UserLearningProfile.TargetLevel resolveTargetLevel() {
        if (targetLevel == null || targetLevel.isBlank()) {
            return UserLearningProfile.TargetLevel.A1;
        }
        return UserLearningProfile.TargetLevel.valueOf(targetLevel);
    }

    public UserLearningProfile.GoalType resolveGoalType() {
        if (goalType == null || goalType.isBlank()) {
            return UserLearningProfile.GoalType.CERT;
        }
        return UserLearningProfile.GoalType.valueOf(goalType);
    }

    public UserLearningProfile.LearningSpeed resolveLearningSpeed() {
        if (learningSpeed == null || learningSpeed.isBlank()) {
            return UserLearningProfile.LearningSpeed.NORMAL;
        }
        return UserLearningProfile.LearningSpeed.valueOf(learningSpeed);
    }
}
