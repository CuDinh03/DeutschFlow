package com.deutschflow.grammar.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Date;

/**
 * Response of {@code POST /api/mock-exams/{examId}/start}.
 * <p>
 * Variant shape, preserved from the old map: a freshly-created attempt carries
 * {@code exam_id}/{@code started_at}/{@code status}, but <em>reusing</em> an in-progress attempt
 * returns only {@code id} (+ the always-present {@code sections_json}/{@code time_limit_minutes}).
 * {@code @JsonInclude(NON_NULL)} reproduces that omission exactly.
 * <p>
 * {@code startedAt} is a {@link java.util.Date} (not {@code Instant}) so the jdbc
 * {@code java.sql.Timestamp} serializes byte-identically to the previous map.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ExamStartDto(
        long id,
        @JsonProperty("exam_id") Long examId,
        @JsonProperty("started_at") Date startedAt,
        String status,
        @JsonProperty("sections_json") String sectionsJson,
        @JsonProperty("time_limit_minutes") Integer timeLimitMinutes) {}
