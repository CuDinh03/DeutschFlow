package com.deutschflow.grammar.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Realistic exam scoring service based on Goethe official rubrics.
 * Scores LESEN and HOEREN automatically (binary correct/incorrect).
 * Prepares scoring templates for SCHREIBEN and SPRECHEN.
 */
@Service
public class ExamScoringService {
    private static final ObjectMapper om = new ObjectMapper();

    /**
     * Score LESEN section - auto-evaluate reading comprehension
     * Each correct answer = 1 point (binary scoring)
     */
    public int scoreLesenSection(Map<String, Object> answers, Map<String, Object> examSection) {
        int score = 0;
        Map<String, Object> teile = (Map<String, Object>) examSection.get("teile");

        if (teile != null) {
            for (Object teilObj : teile.values()) {
                Map<String, Object> teil = (Map<String, Object>) teilObj;
                List<Map<String, Object>> items = (List<Map<String, Object>>) teil.get("items");

                if (items != null) {
                    for (Map<String, Object> item : items) {
                        String itemId = (String) item.get("id");
                        String correct = (String) item.get("correct");
                        Object userAnswer = answers.get(itemId);

                        if (userAnswer != null && userAnswer.toString().equalsIgnoreCase(correct)) {
                            score += 1; // 1 point per correct answer
                        }
                    }
                }
            }
        }

        return Math.min(score, 25); // Max 25 points for LESEN
    }

    /**
     * Score HOEREN section - auto-evaluate listening comprehension
     * Each correct answer = 1 point (binary scoring)
     */
    public int scoreHoerenSection(Map<String, Object> answers, Map<String, Object> examSection) {
        int score = 0;
        List<Map<String, Object>> teile = (List<Map<String, Object>>) examSection.get("teile");

        if (teile != null) {
            for (Map<String, Object> teil : teile) {
                List<Map<String, Object>> items = (List<Map<String, Object>>) teil.get("items");

                if (items != null) {
                    for (Map<String, Object> item : items) {
                        String itemId = (String) item.get("id");
                        String correct = (String) item.get("correct");
                        Object userAnswer = answers.get(itemId);

                        if (userAnswer != null && userAnswer.toString().equalsIgnoreCase(correct)) {
                            score += 1; // 1 point per correct answer
                        }
                    }
                }
            }
        }

        return Math.min(score, 25); // Max 25 points for HOEREN
    }

    /**
     * Score SCHREIBEN section - partially auto, partially AI-evaluated
     * Teil 1 (FILL_FORM): Auto-validate required fields (0-10 points)
     * Teil 2 (WRITE_EMAIL): Requires AI evaluation (0-15 points)
     */
    public Map<String, Object> scoreSchreibenSection(
            Map<String, Object> answers,
            Map<String, Object> examSection) {

        Map<String, Object> result = new HashMap<>();
        int teil1Score = scoreFormFields(answers, examSection);

        // Teil 2 requires AI evaluation - return template
        Map<String, Object> teil2Template = new HashMap<>();
        teil2Template.put("score", 0);
        teil2Template.put("max", 15);
        teil2Template.put("status", "PENDING_AI_EVALUATION");
        teil2Template.put("email_content", answers.get("email_section"));

        result.put("teil1_form", teil1Score);
        result.put("teil1_max", 10);
        result.put("teil2_email", teil2Template);
        result.put("total_provisional", teil1Score); // Will be updated after AI evaluation
        result.put("total_max", 25);

        return result;
    }

    /**
     * Auto-score form fields - check required fields are filled
     */
    private int scoreFormFields(Map<String, Object> answers, Map<String, Object> examSection) {
        List<Map<String, Object>> teile = (List<Map<String, Object>>) examSection.get("teile");
        int score = 0;
        int requiredFields = 0;

        if (teile != null) {
            for (Map<String, Object> teil : teile) {
                if ("FILL_FORM".equals(teil.get("type"))) {
                    List<Map<String, Object>> fields = (List<Map<String, Object>>) teil.get("form_fields");
                    if (fields != null) {
                        requiredFields = fields.size();
                        for (int i = 0; i < fields.size(); i++) {
                            String fieldAnswer = (String) answers.get("form_" + i);
                            if (fieldAnswer != null && !fieldAnswer.trim().isEmpty()) {
                                score += 1;
                            }
                        }
                    }
                }
            }
        }

        // Scale score to 10 points max
        return requiredFields > 0 ? (score * 10) / requiredFields : 0;
    }

    /**
     * Score SPRECHEN section - requires manual evaluation
     * Returns scoring template for evaluator to fill in
     */
    public Map<String, Object> scoreSperechenSection(
            Map<String, Object> answers,
            Map<String, Object> examSection) {

        Map<String, Object> result = new HashMap<>();

        // Teil 1: Self-introduction (max 9 points)
        Map<String, Object> teil1 = new HashMap<>();
        teil1.put("type", "SELF_INTRO");
        teil1.put("max_points", 9);
        teil1.put("rubric", Map.of(
            "aussprache", 3,
            "wortschatz", 2,
            "grammatik", 2,
            "inhalt", 2
        ));
        teil1.put("status", "PENDING_MANUAL_EVALUATION");

        // Teil 2: Q&A daily life (max 8 points)
        Map<String, Object> teil2 = new HashMap<>();
        teil2.put("type", "QA_PARTNER");
        teil2.put("max_points", 8);
        teil2.put("rubric", Map.of(
            "aussprache", 2,
            "wortschatz", 2,
            "grammatik", 2,
            "verständnis", 2
        ));
        teil2.put("status", "PENDING_MANUAL_EVALUATION");

        // Teil 3: Request/respond (max 8 points)
        Map<String, Object> teil3 = new HashMap<>();
        teil3.put("type", "REQUEST_RESPOND");
        teil3.put("max_points", 8);
        teil3.put("rubric", Map.of(
            "aussprache", 2,
            "wortschatz", 2,
            "grammatik", 2,
            "kommunikation", 2
        ));
        teil3.put("status", "PENDING_MANUAL_EVALUATION");

        result.put("teil1", teil1);
        result.put("teil2", teil2);
        result.put("teil3", teil3);
        result.put("total_provisional", 0);
        result.put("total_max", 25);
        result.put("note", "Speaking section requires manual evaluation by certified evaluator");

        return result;
    }

    /**
     * Calculate total exam score from all sections
     */
    public int calculateTotalScore(Map<String, Object> detailedScores) {
        int total = 0;

        for (String section : List.of("LESEN", "HOEREN", "SCHREIBEN", "SPRECHEN")) {
            Map<String, Object> sectionScore = (Map<String, Object>) detailedScores.get(section);
            if (sectionScore != null && sectionScore.containsKey("total")) {
                Object scoreObj = sectionScore.get("total");
                if (scoreObj instanceof Integer) {
                    total += (Integer) scoreObj;
                } else if (scoreObj instanceof Double) {
                    total += ((Double) scoreObj).intValue();
                }
            }
        }

        return total;
    }

    /**
     * Determine if exam passed (>= 60 points out of 100)
     */
    public boolean isPassed(int totalScore) {
        return totalScore >= 60;
    }

    /**
     * Identify weak areas - sections where user scored < 60%
     */
    public List<String> identifyWeakAreas(Map<String, Object> detailedScores) {
        List<String> weakAreas = new ArrayList<>();

        for (String section : List.of("LESEN", "HOEREN", "SCHREIBEN", "SPRECHEN")) {
            Map<String, Object> sectionScore = (Map<String, Object>) detailedScores.get(section);
            if (sectionScore != null) {
                Object totalObj = sectionScore.get("total");
                Object maxObj = sectionScore.get("max");

                if (totalObj != null && maxObj != null) {
                    int total = ((Number) totalObj).intValue();
                    int max = ((Number) maxObj).intValue();
                    int percentage = max > 0 ? (total * 100) / max : 0;

                    if (percentage < 60) {
                        weakAreas.add(section);
                    }
                }
            }
        }

        return weakAreas;
    }

    /**
     * Generate comprehensive detailed scores JSON
     */
    public Map<String, Object> buildDetailedScoresJson(
            int lesenScore,
            int hoerenScore,
            Map<String, Object> schreibenScores,
            Map<String, Object> sprechenScores) {

        Map<String, Object> result = new HashMap<>();

        // LESEN
        result.put("LESEN", Map.of(
            "total", lesenScore,
            "max", 25,
            "percentage", (lesenScore * 100) / 25,
            "status", "COMPLETED"
        ));

        // HOEREN
        result.put("HOEREN", Map.of(
            "total", hoerenScore,
            "max", 25,
            "percentage", (hoerenScore * 100) / 25,
            "status", "COMPLETED"
        ));

        // SCHREIBEN
        result.put("SCHREIBEN", schreibenScores);

        // SPRECHEN
        result.put("SPRECHEN", sprechenScores);

        return result;
    }
}
