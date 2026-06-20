package com.deutschflow.grammar.dto;

import java.util.List;

/**
 * Student progress dashboard overview — response of {@code GET /api/progress/me/overview}.
 * <p>
 * Field names mirror the previous {@code Map<String,Object>} keys 1:1 so the existing web
 * frontend contract is unchanged; this only gives the OpenAPI spec a typed schema for the
 * native iOS client (no free-form object).
 */
public record ProgressOverviewDto(
        String cefrLevel,
        Skills skills,
        double grammarMastery,
        double vocabCoverage,
        int mockExamBestScore,
        boolean examReady,
        List<WeeklyProgressPoint> weeklyProgress) {

    /** Per-skill scores keyed by the four CEFR competencies. */
    public record Skills(SkillScore lesen, SkillScore hoeren, SkillScore schreiben, SkillScore sprechen) {}

    /** A single skill's score (0–100) and how many exercises were completed. */
    public record SkillScore(int score, int exercisesDone) {}

    /** Reserved — {@code weeklyProgress} is always empty today; extend when the weekly trend ships. */
    public record WeeklyProgressPoint() {}
}
