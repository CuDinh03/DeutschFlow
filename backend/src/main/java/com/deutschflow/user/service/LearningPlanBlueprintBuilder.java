package com.deutschflow.user.service;

import com.deutschflow.user.entity.UserLearningProfile;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class LearningPlanBlueprintBuilder {

    private final PersonalizationRulesetService personalizationRulesetService;

    public Map<String, Object> build(UserLearningProfile profile) {
        int weeklyMinutes = profile.getSessionsPerWeek() * profile.getMinutesPerSession();
        int requiredHours = estimateRequiredHours(profile.getCurrentLevel(), profile.getTargetLevel(), profile.getGoalType());
        int weeksTotal = Math.max(4, (int) Math.ceil((requiredHours * 60.0) / Math.max(weeklyMinutes, 1)));

        Map<String, Integer> focusSplit = defaultFocusSplit(profile.getGoalType());
        List<Map<String, Object>> weeks = new ArrayList<>();

        for (int w = 1; w <= Math.min(weeksTotal, 12); w++) {
            weeks.add(buildWeek(w, profile));
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

    private Map<String, Object> buildWeek(int weekNumber, UserLearningProfile profile) {
        List<Map<String, String>> objectives = PlanObjectiveCatalog.weekObjectives(weekNumber, profile.getGoalType());

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
        String type = personalizationRulesetService.resolveSessionType(profile, index);

        List<String> tags = new ArrayList<>();
        if (profile.getIndustry() != null) tags.add(profile.getIndustry());
        tags.add(profile.getTargetLevel().name());
        tags.add("ruleset:" + personalizationRulesetService.activeVersion());

        List<String> skills = switch (type) {
            case "GRAMMAR" -> List.of("GRAMMAR");
            case "PRACTICE" -> List.of("GRAMMAR", "VOCABULARY");
            case "SPEAKING" -> List.of("SPEAKING", "LISTENING");
            case "REVIEW" -> List.of("REVIEW");
            default -> List.of("GRAMMAR");
        };

        int baseDifficulty = estimateSessionDifficulty(type, profile);
        int difficulty = personalizationRulesetService.personalizeDifficulty(baseDifficulty, type, profile);
        Map<String, Object> contentRef = buildContentRef(type, profile);
        Map<String, Object> details = buildSessionDetails(type, profile, difficulty);

        return new LinkedHashMap<>(Map.of(
                "index", index,
                "type", type,
                "minutes", profile.getMinutesPerSession(),
                "tags", tags,
                "skills", skills,
                "difficulty", difficulty,
                "contentRef", contentRef,
                "details", details
        ));
    }

    private Map<String, Object> buildSessionDetails(String type, UserLearningProfile profile, int difficulty) {
        int minutes = profile.getMinutesPerSession();
        String cefr = profile.getTargetLevel().name();
        String industry = personalizationRulesetService.industryOrDefault(profile);

        List<String> theory = new ArrayList<>();
        List<Map<String, Object>> exercises = new ArrayList<>();

        if ("GRAMMAR".equals(type)) {
            theory.add("Definite/indefinite articles (der/die/das, ein/eine)");
            theory.add("Basic word order (SVO) in Hauptsatz");
            exercises.add(ex("Article pick (DER/DIE/DAS)", "GRAMMAR", difficulty, Math.max(5, minutes / 3)));
            exercises.add(ex("Fill the blank: Ich ___ Student.", "GRAMMAR", difficulty, Math.max(5, minutes / 3)));
        } else if ("PRACTICE".equals(type)) {
            theory.add("High-frequency phrases for " + industry);
            exercises.add(ex("Vocabulary-in-context (short sentences)", "VOCABULARY", difficulty, Math.max(6, minutes / 2)));
            exercises.add(ex("Mini quiz: choose correct article + noun", "GRAMMAR", difficulty, Math.max(6, minutes / 2)));
        } else if ("SPEAKING".equals(type)) {
            theory.add("Speaking drills (shadowing) at " + cefr);
            exercises.add(ex("Dialogue role-play (contextual)", "SPEAKING", difficulty, Math.max(8, minutes)));
        } else {
            theory.add("Spaced review (SRS-style) + quick recap");
            exercises.add(ex("Review quiz (mixed)", "REVIEW", difficulty, Math.max(6, minutes)));
        }

        return new LinkedHashMap<>(Map.of(
                "title", type + " session",
                "theory", theory,
                "exercises", exercises
        ));
    }

    private Map<String, Object> ex(String title, String skill, int difficulty, int minutes) {
        return new LinkedHashMap<>(Map.of(
                "title", title,
                "skill", skill,
                "difficulty", difficulty,
                "minutes", minutes
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
        return Math.min(10, Math.max(1, base));
    }

    private Map<String, Object> buildContentRef(String type, UserLearningProfile profile) {
        String cefr = profile.getTargetLevel().name();
        String industry = profile.getIndustry();

        if ("GRAMMAR".equals(type)) {
            return new LinkedHashMap<>(Map.of(
                    "module", "GRAMMAR",
                    "cefr", cefr,
                    "topics", List.of("ARTICLES", "BASIC_WORD_ORDER")
            ));
        }

        if ("PRACTICE".equals(type)) {
            return new LinkedHashMap<>(Map.of(
                    "module", "PRACTICE",
                    "cefr", cefr,
                    "topics", industry != null ? List.of(industry) : List.of("GENERAL")
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
                "module", "REVIEW",
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
}

