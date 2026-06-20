package com.deutschflow.grammar.dto;

import java.util.List;

/**
 * Response of {@code GET /api/mock-exams/recommend?cefrLevel=}.
 * Keys are camelCase, matching the prior {@code Map.of(...)} (the only camelCase MockExam response).
 * {@code recommendedExamId} is {@code -1} when nothing is recommended.
 */
public record ExamRecommendationDto(long recommendedExamId, String cefrLevel, List<ExamStatDto> examStats) {}
