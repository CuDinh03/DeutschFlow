package com.deutschflow.teacher.curriculumimport.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * One planned teaching session in the preview. {@code clientId} is a preview-only handle so the
 * wizard can address a row it is editing; it never reaches the database.
 *
 * <p>{@code plannedDate} stays null unless the teacher supplied a start date — the spec is explicit
 * that the importer must not invent a schedule.
 */
public record DraftLesson(
        String clientId,
        String title,
        String cefrLevel,
        Integer estimatedUnits,
        LocalDate plannedDate,
        Integer sourcePageFrom,
        Integer sourcePageTo,
        List<DraftKnowledgePoint> knowledgePoints,
        List<DraftCanDoStatement> canDoStatements) {}
