package com.deutschflow.teacher.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * Create a class lesson. Prefer {@code knowledgePoints} (structured, Phase 1b) — when
 * present it is the source of truth and the service derives {@code description} from it
 * (dual-write for legacy/mobile). A raw {@code description} is still accepted for the
 * legacy path when {@code knowledgePoints} is null.
 */
public record CreateLessonRequest(
        String title,
        String description,
        String cefrLevel,
        LocalDate plannedDate,
        Integer estimatedUnits,
        List<KnowledgePointInput> knowledgePoints,
        List<CanDoStatementInput> canDoStatements
) {}
