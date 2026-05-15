package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;

public record StudentAssignmentDto(
        Long id,
        Long assignmentId,
        Long studentId,
        String status,
        Integer teacherScore,
        String teacherFeedback,
        LocalDateTime submittedAt,
        LocalDateTime createdAt,
        String topic,
        String description,
        String assignmentType,
        LocalDateTime dueDate,
        String submissionContent,
        String submissionFileUrl
) {}
