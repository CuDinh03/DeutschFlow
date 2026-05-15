package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;

public record CreateAssignmentRequest(
        String topic,
        String description,
        String assignmentType,
        Long referenceId,
        LocalDateTime dueDate
) {}
