package com.deutschflow.user.service;

import com.deutschflow.user.entity.UserLearningProfile;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class PersonalizationRulesetService {

    private static final String ACTIVE_VERSION = "ruleset-v1-w4";

    public String activeVersion() {
        return ACTIVE_VERSION;
    }

    public Map<String, Object> describeActiveRuleset() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("version", ACTIVE_VERSION);
        out.put("dimensionsSupported", List.of(
                "goalType",
                "targetLevel",
                "learningSpeed",
                "industry",
                "sessionsPerWeek",
                "minutesPerSession"
        ));
        return out;
    }

    public String resolveSessionType(UserLearningProfile profile, int sessionIndex) {
        if (profile.getGoalType() == UserLearningProfile.GoalType.WORK) {
            return switch (sessionIndex % 4) {
                case 1 -> "PRACTICE";
                case 2 -> "GRAMMAR";
                case 3 -> "SPEAKING";
                default -> "REVIEW";
            };
        }
        return switch (sessionIndex % 4) {
            case 1 -> "GRAMMAR";
            case 2 -> "PRACTICE";
            case 3 -> "SPEAKING";
            default -> "REVIEW";
        };
    }

    public int personalizeDifficulty(int baseDifficulty, String sessionType, UserLearningProfile profile) {
        int out = baseDifficulty;
        if ("SPEAKING".equals(sessionType) && profile.getGoalType() == UserLearningProfile.GoalType.WORK) {
            out += 1;
        }
        if ("GRAMMAR".equals(sessionType) && profile.getGoalType() == UserLearningProfile.GoalType.CERT) {
            out += 1;
        }
        if (profile.getLearningSpeed() == UserLearningProfile.LearningSpeed.FAST) {
            out += 1;
        }
        if (profile.getLearningSpeed() == UserLearningProfile.LearningSpeed.SLOW) {
            out -= 1;
        }
        return Math.max(1, Math.min(10, out));
    }

    public String industryOrDefault(UserLearningProfile profile) {
        return profile.getIndustry() == null || profile.getIndustry().isBlank()
                ? "GENERAL"
                : profile.getIndustry().trim();
    }
}
