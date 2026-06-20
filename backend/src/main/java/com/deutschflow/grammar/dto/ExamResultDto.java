package com.deutschflow.grammar.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Date;

/**
 * Result of a single attempt — response of {@code GET /api/mock-exams/attempts/{attemptId}/result}.
 * <p>
 * Same shape as {@link ExamAttemptDto} except the exam name key is {@code title} (the result query
 * selects {@code e.title} unaliased, whereas the history query aliases it {@code exam_title}).
 */
public record ExamResultDto(
        long id,
        @JsonProperty("exam_id") Long examId,
        String title,
        @JsonProperty("started_at") Date startedAt,
        @JsonProperty("finished_at") Date finishedAt,
        @JsonProperty("total_score") Integer totalScore,
        Boolean passed,
        String status,
        @JsonProperty("detailed_scores_json") String detailedScoresJson,
        @JsonProperty("weak_areas") String weakAreas) {}
