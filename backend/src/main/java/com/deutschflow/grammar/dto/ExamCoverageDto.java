package com.deutschflow.grammar.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * Exam coverage summary for a CEFR level — response of
 * {@code GET /api/mock-exams/coverage?cefrLevel=}. Keys mirror the prior map exactly.
 */
public record ExamCoverageDto(String cefrLevel, int totalExams, List<Exam> exams) {

    public record Exam(
            long id,
            String title,
            @JsonProperty("is_active") Boolean isActive,
            @JsonProperty("attempt_count") Long attemptCount) {}
}
