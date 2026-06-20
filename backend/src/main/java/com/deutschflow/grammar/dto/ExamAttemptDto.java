package com.deutschflow.grammar.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Date;

/**
 * One row of a user's attempt history — element of {@code GET /api/mock-exams/attempts/me}.
 * <p>
 * All keys are always present (nulls included, matching the prior {@code queryForList} map);
 * {@code detailedScoresJson}/{@code weakAreas} are raw JSON <em>strings</em> the client parses.
 * Timestamps use {@link java.util.Date} to keep the exact serialization.
 */
public record ExamAttemptDto(
        long id,
        @JsonProperty("exam_id") Long examId,
        @JsonProperty("exam_title") String examTitle,
        @JsonProperty("started_at") Date startedAt,
        @JsonProperty("finished_at") Date finishedAt,
        @JsonProperty("total_score") Integer totalScore,
        Boolean passed,
        String status,
        @JsonProperty("detailed_scores_json") String detailedScoresJson,
        @JsonProperty("weak_areas") String weakAreas) {}
