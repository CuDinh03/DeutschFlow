package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;

public record ClassLessonDto(
        Long id,
        Long classId,
        int orderIndex,
        String title,
        String description,
        boolean completed,
        LocalDateTime completedAt,
        Long completedByTeacherId,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
