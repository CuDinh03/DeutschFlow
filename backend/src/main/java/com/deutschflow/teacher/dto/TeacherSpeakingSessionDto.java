package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;

public record TeacherSpeakingSessionDto(
        Long id,
        Long userId,
        String topic,
        String cefrLevel,
        String status,
        Integer messageCount,
        Integer aiScore,
        String aiFeedback,
        Integer teacherScore,
        String teacherFeedback,
        LocalDateTime startedAt,
        LocalDateTime endedAt,
        LocalDateTime reviewedAt
) {}
