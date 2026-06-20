package com.deutschflow.grammar.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * One row of the mock-exam list — response element of {@code GET /api/mock-exams?cefrLevel=}.
 * <p>
 * JSON keys are kept snake_case (raw {@code mock_exams} columns) to match the existing web/mobile
 * contract; {@code @JsonProperty} maps them onto idiomatic camelCase record components.
 */
public record ExamSummaryDto(
        long id,
        @JsonProperty("cefr_level") String cefrLevel,
        @JsonProperty("exam_format") String examFormat,
        String title,
        @JsonProperty("description_vi") String descriptionVi,
        @JsonProperty("total_points") Integer totalPoints,
        @JsonProperty("pass_points") Integer passPoints,
        @JsonProperty("time_limit_minutes") Integer timeLimitMinutes) {}
