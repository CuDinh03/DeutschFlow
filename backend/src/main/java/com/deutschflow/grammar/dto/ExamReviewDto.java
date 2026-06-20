package com.deutschflow.grammar.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * Per-question review of a completed attempt — response of
 * {@code GET /api/mock-exams/attempts/{attemptId}/review}.
 * <p>
 * Item keys keep the prior snake_case ({@code user_answer}, {@code correct_answer},
 * {@code is_correct}); {@code explanation} is omitted when absent (matches the old map, which only
 * put it when non-null).
 */
public record ExamReviewDto(long attemptId, int totalScore, List<Section> sections) {

    public record Section(String sectionName, List<Item> items) {}

    public record Item(
            String id,
            String question,
            @JsonProperty("user_answer") String userAnswer,
            @JsonProperty("correct_answer") String correctAnswer,
            @JsonProperty("is_correct") boolean isCorrect,
            @JsonInclude(JsonInclude.Include.NON_NULL) String explanation) {}
}
