package com.deutschflow.teacher.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * Partial update for a class lesson. A null value field is left untouched (PATCH
 * semantics), consistent with title/description/completed — so a completion-toggle that
 * sends only {@code completed} never disturbs the other fields.
 *
 * <p>To CLEAR an optional field back to null, set its {@code clear*} flag = true (a plain
 * null can't distinguish "leave as-is" from "set to null"). A clear flag takes precedence
 * over any value sent for the same field.
 *
 * <p>{@code knowledgePoints} (Phase 1b): when non-null it REPLACES the lesson's points in
 * the sub-table and the service re-derives {@code description} from it (dual-write). Send an
 * empty list to clear all points; send null to leave them untouched.
 */
public record UpdateLessonRequest(
        String title,
        String description,
        Boolean completed,
        String cefrLevel,
        LocalDate plannedDate,
        Integer estimatedUnits,
        List<KnowledgePointInput> knowledgePoints,
        Boolean clearCefrLevel,
        Boolean clearPlannedDate,
        Boolean clearEstimatedUnits,
        List<CanDoStatementInput> canDoStatements
) {}
