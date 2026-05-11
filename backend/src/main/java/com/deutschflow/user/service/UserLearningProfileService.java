package com.deutschflow.user.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.user.dto.LearningProfileResponse;
import com.deutschflow.user.dto.OnboardingProfileRequest;
import com.deutschflow.user.dto.UpdateLearningProfileRequest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class UserLearningProfileService {
    private final UserLearningProfileRepository profileRepository;
    private final StoredLearningPlanSupport storedLearningPlanSupport;
    private final ObjectMapper objectMapper;

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

    // ── Settings page methods ────────────────────────────────────────────

    /**
     * Partial update cho trang Settings — chỉ update các field được gửi lên (non-null).
     */
    public UserLearningProfile partialUpdate(User user, UpdateLearningProfileRequest req) {
        UserLearningProfile profile = profileRepository.findByUserId(user.getId())
                .orElseThrow(() -> new NotFoundException("Learning profile not found. Please complete onboarding first."));

        if (req.goalType() != null) {
            profile.setGoalType(parseEnum(UserLearningProfile.GoalType.class, req.goalType(), "goalType"));
        }
        if (req.targetLevel() != null) {
            profile.setTargetLevel(parseEnum(UserLearningProfile.TargetLevel.class, req.targetLevel(), "targetLevel"));
        }
        if (req.industry() != null) {
            profile.setIndustry(blankToNull(req.industry()));
        }
        if (req.interests() != null) {
            profile.setInterestsJson(storedLearningPlanSupport.toJsonOrNull(req.interests()));
        }
        if (req.learningSpeed() != null) {
            profile.setLearningSpeed(parseEnum(UserLearningProfile.LearningSpeed.class, req.learningSpeed(), "learningSpeed"));
        }
        if (req.sessionsPerWeek() != null) {
            profile.setSessionsPerWeek(req.sessionsPerWeek());
        }
        if (req.minutesPerSession() != null) {
            profile.setMinutesPerSession(req.minutesPerSession());
        }

        return profileRepository.save(profile);
    }

    /**
     * Convert entity → response DTO cho settings page pre-fill.
     */
    public LearningProfileResponse toResponse(UserLearningProfile p) {
        List<String> interests = Collections.emptyList();
        if (p.getInterestsJson() != null && !p.getInterestsJson().isBlank()) {
            try {
                interests = objectMapper.readValue(p.getInterestsJson(), new TypeReference<List<String>>() {});
            } catch (Exception ignored) {}
        }
        return new LearningProfileResponse(
                p.getGoalType() != null ? p.getGoalType().name() : null,
                p.getTargetLevel() != null ? p.getTargetLevel().name() : null,
                p.getCurrentLevel() != null ? p.getCurrentLevel().name() : null,
                p.getIndustry(),
                interests,
                p.getLearningSpeed() != null ? p.getLearningSpeed().name() : null,
                p.getSessionsPerWeek(),
                p.getMinutesPerSession(),
                p.getExamType(),
                p.getAgeRange() != null ? p.getAgeRange().name() : null
        );
    }

