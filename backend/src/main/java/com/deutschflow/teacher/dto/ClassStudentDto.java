package com.deutschflow.teacher.dto;

public record ClassStudentDto(
        Long studentId,
        String displayName,
        String email,
        Integer xp,
        Integer level,
        String cefrLevel
) {}
