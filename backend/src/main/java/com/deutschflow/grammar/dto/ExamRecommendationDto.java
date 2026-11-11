package com.deutschflow.grammar.dto;

import java.util.List;

/**
 * Response of {@code GET /api/mock-exams/recommend?cefrLevel=&examFormat=}.
 * Keys are camelCase, matching the prior {@code Map.of(...)} (the only camelCase MockExam response).
 * {@code recommendedExamId} is {@code -1} when nothing is recommended. {@code examFormat} là kỳ thi
 * máy đã chốt (GOETHE/TELC): gợi ý và thống kê chỉ gồm đề của kỳ thi đó.
 */
public record ExamRecommendationDto(long recommendedExamId, String cefrLevel, String examFormat,
                                    List<ExamStatDto> examStats) {}
