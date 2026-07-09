package com.deutschflow.teacher.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record ClassLessonDto(
        Long id,
        Long classId,
        int orderIndex,
        Long moduleId,
        String title,
        String description,
        String cefrLevel,
        LocalDate plannedDate,
        Integer estimatedUnits,
        boolean completed,
        LocalDateTime completedAt,
        Long completedByTeacherId,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        List<KnowledgePointDto> knowledgePoints,
        List<CanDoStatementDto> canDoStatements
) {}
