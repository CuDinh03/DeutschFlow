package com.deutschflow.teacher.dto;

import java.util.List;

/**
 * Teacher-facing competency overview of a class (Phase 2c): for each can-do of the class's lessons,
 * how many enrolled students have mastered / are in progress. The rest of {@code enrolledCount} are
 * NOT_STARTED. Drives the "which competencies does the class need to work on" remediation view.
 */
public record ClassCompetencyDto(
        int enrolledCount,
        List<CanDoCompetencyDto> items
) {
    public record CanDoCompetencyDto(
            Long canDoStatementId,
            Long lessonId,
            String lessonTitle,
            String text,
            String skillTag,
            String cefrLevel,
            int mastered,
            int inProgress
    ) {}
}
