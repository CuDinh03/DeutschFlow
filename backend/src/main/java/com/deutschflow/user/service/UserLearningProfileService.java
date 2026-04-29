package com.deutschflow.user.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.user.dto.OnboardingProfileRequest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
@RequiredArgsConstructor
public class UserLearningProfileService {
    private final UserLearningProfileRepository profileRepository;
    private final StoredLearningPlanSupport storedLearningPlanSupport;

    public UserLearningProfile upsertProfile(User user, OnboardingProfileRequest req) {
        if (req.sessionsPerWeek() == null || req.minutesPerSession() == null) {
            throw new BadRequestException("sessionsPerWeek and minutesPerSession are required");
        }

        UserLearningProfile.GoalType goalType = parseEnum(UserLearningProfile.GoalType.class, req.goalType(), "goalType");
        UserLearningProfile.TargetLevel targetLevel = parseEnum(UserLearningProfile.TargetLevel.class, req.targetLevel(), "targetLevel");
        UserLearningProfile.CurrentLevel currentLevel = (req.currentLevel() == null || req.currentLevel().isBlank())
                ? UserLearningProfile.CurrentLevel.A0
                : parseEnum(UserLearningProfile.CurrentLevel.class, req.currentLevel(), "currentLevel");

        UserLearningProfile.AgeRange ageRange = (req.ageRange() == null || req.ageRange().isBlank())
                ? null
                : parseEnum(UserLearningProfile.AgeRange.class, req.ageRange(), "ageRange");

        UserLearningProfile.LearningSpeed learningSpeed = (req.learningSpeed() == null || req.learningSpeed().isBlank())
                ? UserLearningProfile.LearningSpeed.NORMAL
                : parseEnum(UserLearningProfile.LearningSpeed.class, req.learningSpeed(), "learningSpeed");

        UserLearningProfile profile = profileRepository.findByUserId(user.getId())
                .orElse(UserLearningProfile.builder().user(user).build());

        profile.setGoalType(goalType);
        profile.setTargetLevel(targetLevel);
        profile.setCurrentLevel(currentLevel);
        profile.setAgeRange(ageRange);
        profile.setInterestsJson(storedLearningPlanSupport.toJsonOrNull(req.interests()));
        profile.setIndustry(blankToNull(req.industry()));
        profile.setWorkUseCasesJson(storedLearningPlanSupport.toJsonOrNull(req.workUseCases()));
        profile.setExamType(blankToNull(req.examType()));
        profile.setSessionsPerWeek(req.sessionsPerWeek());
        profile.setMinutesPerSession(req.minutesPerSession());
        profile.setLearningSpeed(learningSpeed);

        return profileRepository.save(profile);
    }

    private <E extends Enum<E>> E parseEnum(Class<E> clazz, String raw, String field) {
        try {
            return Enum.valueOf(clazz, normalizeEnumToken(raw));
        } catch (Exception e) {
            throw new BadRequestException("Invalid " + field);
        }
    }

    private String normalizeEnumToken(String raw) {
        if (raw == null) return "";
        String s = raw.trim()
                .toUpperCase(Locale.ROOT)
                .replace('-', '_')
                .replace(' ', '_');
        if (s.equals("45+")) return "AGE_45_PLUS";
        if (s.matches("^\\d.*")) return "AGE_" + s;
        return s;
    }

    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}

