package com.deutschflow.grammar.dto;

import java.util.List;

/** A mock-exam pack with its exams (D3), returned only when the user may access the pack. */
public record MockExamPackDetailDto(
        Long id,
        String title,
        String descriptionVi,
        String cefrLevel,
        String examFormat,
        List<PackExamDto> exams
) {
    /** One exam within a pack. {@code comingSoon} = đề nháp chờ duyệt (V342): hiện "Sắp có", không làm được. */
    public record PackExamDto(
            Long id,
            String title,
            Integer totalPoints,
            Integer passPoints,
            Integer timeLimitMinutes,
            boolean comingSoon
    ) {}
}
