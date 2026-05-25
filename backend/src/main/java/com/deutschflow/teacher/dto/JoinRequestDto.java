package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;

public record JoinRequestDto(
        Long id,
        Long studentId,
        String studentName,
        String studentEmail,
        String status,
        LocalDateTime createdAt
) {}
