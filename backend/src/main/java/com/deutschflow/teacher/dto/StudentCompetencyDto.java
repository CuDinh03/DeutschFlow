package com.deutschflow.teacher.dto;

/** A student's competency status for one can-do statement. source = SELF|GRADING|SRS (Phase 2a/2b). */
public record StudentCompetencyDto(
        Long canDoStatementId,
        String status,
        String source
) {}
