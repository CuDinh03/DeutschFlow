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
    /** One exam within a pack. */
    public record PackExamDto(
            Long id,
            String title,
            Integer totalPoints,
            Integer passPoints,
            Integer timeLimitMinutes
    ) {}
}
