package com.deutschflow.user.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.user.dto.LearningPlanResponse;
import com.deutschflow.user.dto.OnboardingProfileRequest;
import com.deutschflow.user.entity.LearningPlan;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.entity.UserLearningProfile;
import com.deutschflow.user.repository.LearningPlanRepository;
import com.deutschflow.user.repository.UserLearningProfileRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
public class LearningPlanService {

    private final UserLearningProfileRepository profileRepository;
    private final LearningPlanRepository planRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public LearningPlanResponse saveProfileAndGeneratePlan(User user, OnboardingProfileRequest req) {
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

        String interestsJson = toJsonOrNull(req.interests());
        String workUseCasesJson = toJsonOrNull(req.workUseCases());

        UserLearningProfile profile = profileRepository.findByUserId(user.getId())
                .orElse(UserLearningProfile.builder().user(user).build());

        profile.setGoalType(goalType);
        profile.setTargetLevel(targetLevel);
        profile.setCurrentLevel(currentLevel);
        profile.setAgeRange(ageRange);
        profile.setInterestsJson(interestsJson);
        profile.setIndustry(blankToNull(req.industry()));
        profile.setWorkUseCasesJson(workUseCasesJson);
        profile.setExamType(blankToNull(req.examType()));
        profile.setSessionsPerWeek(req.sessionsPerWeek());
        profile.setMinutesPerSession(req.minutesPerSession());
        profile.setLearningSpeed(learningSpeed);

        profile = profileRepository.save(profile);

        Map<String, Object> plan = generatePlan(profile);
        int weeklyMinutes = profile.getSessionsPerWeek() * profile.getMinutesPerSession();
        int weeksTotal = (int) plan.getOrDefault("weeksTotal", 8);

        LearningPlan lp = planRepository.findByUserId(user.getId())
                .orElse(LearningPlan.builder().user(user).build());
        lp.setProfile(profile);
        lp.setGoalType(goalType);
        lp.setTargetLevel(targetLevel);
        lp.setCurrentLevel(currentLevel);
        lp.setSessionsPerWeek(profile.getSessionsPerWeek());
        lp.setMinutesPerSession(profile.getMinutesPerSession());
        lp.setWeeklyMinutes(weeklyMinutes);
        lp.setWeeksTotal(weeksTotal);
        lp.setPlanJson(toJson(plan));

        planRepository.save(lp);
        return new LearningPlanResponse(weeklyMinutes, weeksTotal, plan);
    }

    @Transactional(readOnly = true)
    public LearningPlanResponse getMyPlan(User user) {
        LearningPlan plan = planRepository.findByUserId(user.getId())
                .orElseThrow(() -> new NotFoundException("Learning plan not found"));
        Map<String, Object> planObj = fromJsonMap(plan.getPlanJson());
        return new LearningPlanResponse(plan.getWeeklyMinutes(), plan.getWeeksTotal(), planObj);
    }

    @Transactional(readOnly = true)
    public boolean hasPlan(User user) {
        return planRepository.findByUserId(user.getId()).isPresent();
    }

    private Map<String, Object> generatePlan(UserLearningProfile profile) {
        int weeklyMinutes = profile.getSessionsPerWeek() * profile.getMinutesPerSession();
        int requiredHours = estimateRequiredHours(profile.getCurrentLevel(), profile.getTargetLevel(), profile.getGoalType());
        int weeksTotal = Math.max(4, (int) Math.ceil((requiredHours * 60.0) / Math.max(weeklyMinutes, 1)));

        Map<String, Integer> focusSplit = defaultFocusSplit(profile.getGoalType());
        List<Map<String, Object>> weeks = new ArrayList<>();

        for (int w = 1; w <= Math.min(weeksTotal, 12); w++) { // MVP: materialize first 12 weeks
            weeks.add(buildWeek(w, profile, focusSplit));
        }

        return new LinkedHashMap<>(Map.of(
                "goalType", profile.getGoalType().name(),
                "targetLevel", profile.getTargetLevel().name(),
                "currentLevel", profile.getCurrentLevel().name(),
                "weeklyMinutes", weeklyMinutes,
                "weeksTotal", weeksTotal,
                "focusSplit", focusSplit,
                "weeks", weeks
        ));
    }

    private Map<String, Object> buildWeek(int weekNumber, UserLearningProfile profile, Map<String, Integer> focusSplit) {
        List<String> objectives = new ArrayList<>();
        objectives.add("Build habit: complete all scheduled sessions");

        if (profile.getGoalType() == UserLearningProfile.GoalType.WORK) {
            objectives.add("Learn job-relevant vocabulary for your industry");
            objectives.add("Practice short dialogues for real situations");
        } else {
            objectives.add("Cover core grammar points for the exam level");
            objectives.add("Practice listening/reading in exam-like format");
        }

        if (weekNumber <= 2) {
            objectives.add("Establish A1 foundations (basic phrases, articles, sentence order)");
        } else if (weekNumber % 4 == 0) {
            objectives.add("Checkpoint: review + mini test");
        }

        List<Map<String, Object>> sessions = new ArrayList<>();
        for (int i = 1; i <= profile.getSessionsPerWeek(); i++) {
            sessions.add(buildSession(i, profile));
        }

        return new LinkedHashMap<>(Map.of(
                "week", weekNumber,
                "objectives", objectives,
                "sessions", sessions
        ));
    }

    private Map<String, Object> buildSession(int index, UserLearningProfile profile) {
        String type;
        if (profile.getGoalType() == UserLearningProfile.GoalType.WORK) {
            type = (index % 3 == 0) ? "SPEAKING" : "VOCAB";
        } else {
            type = (index % 2 == 0) ? "GRAMMAR" : "MOCK";
        }

        List<String> tags = new ArrayList<>();
        if (profile.getIndustry() != null) tags.add(profile.getIndustry());
        tags.add(profile.getTargetLevel().name());

        List<String> skills = switch (type) {
            case "VOCAB" -> List.of("VOCABULARY");
            case "GRAMMAR" -> List.of("GRAMMAR");
            case "SPEAKING" -> List.of("SPEAKING", "LISTENING");
            case "MOCK" -> List.of("GRAMMAR", "VOCABULARY", "LISTENING", "SPEAKING");
            default -> List.of("VOCABULARY");
        };

        int difficulty = estimateSessionDifficulty(type, profile);
        Map<String, Object> contentRef = buildContentRef(type, profile);

        return new LinkedHashMap<>(Map.of(
                "index", index,
                "type", type,
                "minutes", profile.getMinutesPerSession(),
                "tags", tags,
                "skills", skills,
                "difficulty", difficulty,
                "contentRef", contentRef
        ));
    }

    private int estimateSessionDifficulty(String type, UserLearningProfile profile) {
        int base = switch (profile.getTargetLevel()) {
            case A1 -> 2;
            case A2 -> 4;
            case B1 -> 6;
            case B2 -> 7;
            case C1 -> 8;
            case C2 -> 9;
        };
        if ("MOCK".equals(type)) base += 1;
        if ("SPEAKING".equals(type)) base += 1;
        if (profile.getLearningSpeed() == UserLearningProfile.LearningSpeed.FAST) base += 1;
        if (profile.getLearningSpeed() == UserLearningProfile.LearningSpeed.SLOW) base -= 1;
        return Math.min(10, Math.max(1, base));
    }

    private Map<String, Object> buildContentRef(String type, UserLearningProfile profile) {
        String cefr = profile.getTargetLevel().name();
        String industry = profile.getIndustry();

        if ("VOCAB".equals(type)) {
            return new LinkedHashMap<>(Map.of(
                    "module", "VOCABULARY",
                    "cefr", cefr,
                    "topics", industry != null ? List.of(industry) : List.of("GENERAL"),
                    "suggestedTags", industry != null ? List.of(industry, "A1_BASE") : List.of("A1_BASE")
            ));
        }

        if ("GRAMMAR".equals(type)) {
            return new LinkedHashMap<>(Map.of(
                    "module", "GRAMMAR",
                    "cefr", cefr,
                    "topics", List.of("ARTICLES", "BASIC_WORD_ORDER")
            ));
        }

        if ("SPEAKING".equals(type)) {
            return new LinkedHashMap<>(Map.of(
                    "module", "SPEAKING",
                    "cefr", cefr,
                    "scenarios", industry != null ? List.of("WORK_" + industry) : List.of("DAILY_LIFE"),
                    "promptStyle", "CONTEXTUAL_DIALOGUE"
            ));
        }

        return new LinkedHashMap<>(Map.of(
                "module", "MIXED",
                "cefr", cefr
        ));
    }

    private Map<String, Integer> defaultFocusSplit(UserLearningProfile.GoalType goalType) {
        if (goalType == UserLearningProfile.GoalType.WORK) {
            return new LinkedHashMap<>(Map.of(
                    "VOCAB", 35,
                    "SPEAKING", 25,
                    "GRAMMAR", 20,
                    "LISTENING", 10,
                    "REVIEW", 10
            ));
        }
        return new LinkedHashMap<>(Map.of(
                "GRAMMAR", 30,
                "READING", 20,
                "LISTENING", 20,
                "WRITING", 15,
                "SPEAKING", 10,
                "REVIEW", 5
        ));
    }

    private int estimateRequiredHours(UserLearningProfile.CurrentLevel current, UserLearningProfile.TargetLevel target, UserLearningProfile.GoalType goalType) {
        int base = switch (target) {
            case A1 -> 90;
            case A2 -> 160;
            case B1 -> 280;
            case B2 -> 420;
            case C1 -> 600;
            case C2 -> 800;
        };
        if (goalType == UserLearningProfile.GoalType.CERT) base = (int) Math.round(base * 1.1);
        if (current != UserLearningProfile.CurrentLevel.A0) base = (int) Math.round(base * 0.7);
        return base;
    }

    private <E extends Enum<E>> E parseEnum(Class<E> clazz, String raw, String field) {
        try {
            return Enum.valueOf(clazz, normalizeEnumToken(raw));
        } catch (Exception e) {
            throw new BadRequestException("Invalid " + field);
        }
    }

    /**
     * Accept common user-facing inputs and normalize to enum names.
     * Examples:
     * - "b1" -> "B1"
     * - "18_24" -> "AGE_18_24"
     * - "age_18_24" -> "AGE_18_24"
     * - "45+" -> "AGE_45_PLUS"
     */
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

    private String toJsonOrNull(Object obj) {
        if (obj == null) return null;
        if (obj instanceof Collection<?> c && c.isEmpty()) return null;
        return toJson(obj);
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            throw new BadRequestException("Invalid JSON payload");
        }
    }

    private Map<String, Object> fromJsonMap(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }
}

