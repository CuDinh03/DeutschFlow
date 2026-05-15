package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;

public record ClassAssignmentDto(
        Long id,
        Long classId,
        String topic,
        String description,
        String assignmentType,
        Long referenceId,
        LocalDateTime dueDate,
        LocalDateTime createdAt
) {}
