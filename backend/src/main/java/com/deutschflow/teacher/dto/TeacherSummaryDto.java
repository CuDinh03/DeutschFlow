package com.deutschflow.teacher.dto;

public record TeacherSummaryDto(
        Long id,
        String displayName,
        String email,
        String role
) {}
