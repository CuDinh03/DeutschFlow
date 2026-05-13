package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;

public record ClassAssignmentDto(
        Long id,
        Long classId,
        String topic,
        String description,
        LocalDateTime createdAt
) {}
