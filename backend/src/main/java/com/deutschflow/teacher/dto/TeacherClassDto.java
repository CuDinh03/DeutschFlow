package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;

public record TeacherClassDto(
        Long id,
        String name,
        String inviteCode,
        long studentCount,
        long quizCount,
        LocalDateTime createdAt
) {}
