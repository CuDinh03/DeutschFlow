package com.deutschflow.teacher.dto;

/**
 * The requesting student's OWN 4-skill report row (never the class list).
 * Each skill is 0-100 (teacher-set score, or the average of the student's skill-tagged
 * assignment scores as a fallback); null when there is no data for that skill yet.
 */
public record MySkillReportDto(
        Double horen,
        Double lesen,
        Double schreiben,
        Double sprechen,
        Double total,
        String grade
) {}
