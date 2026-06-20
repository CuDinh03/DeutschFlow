package com.deutschflow.grammar.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Sanitized exam content — response of {@code GET /api/mock-exams/{examId}/questions}.
 * <p>
 * {@code sectionsJson} is a JSON <em>string</em> (the answer-key-stripped {@code sections_json}
 * blob); the client parses it. Kept as a string to match the existing contract exactly.
 */
public record ExamQuestionsDto(
        @JsonProperty("sections_json") String sectionsJson) {}
