package com.deutschflow.grammar.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Date;
import java.util.Map;

/**
 * Per-exam attempt stats — element of {@code examStats} in {@code GET /api/mock-exams/recommend}.
 * Built from the {@code ExamGenerationService.getUserExamStats} rows (which stay {@code Map}-based,
 * an internal service shape). Keys/types mirror those rows exactly.
 */
public record ExamStatDto(
        @JsonProperty("exam_id") Long examId,
        String title,
        @JsonProperty("total_attempts") Long totalAttempts,
        @JsonProperty("completed_attempts") Long completedAttempts,
        @JsonProperty("best_score") Integer bestScore,
        @JsonProperty("last_attempted_at") Date lastAttemptedAt) {

    public static ExamStatDto from(Map<String, Object> m) {
        return new ExamStatDto(
                asLong(m.get("exam_id")),
                (String) m.get("title"),
                asLong(m.get("total_attempts")),
                asLong(m.get("completed_attempts")),
                m.get("best_score") != null ? ((Number) m.get("best_score")).intValue() : null,
                (Date) m.get("last_attempted_at"));
    }

    private static Long asLong(Object v) {
        return v != null ? ((Number) v).longValue() : null;
    }
}
