package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;
import java.util.List;

public record ClassroomDetailDto(
        Long id,
        String name,
        String inviteCode,
        List<TeacherSummaryDto> teachers,
        long studentCount,
        long assignmentCount,
        long pendingCount,
        long submittedCount,
        long gradedCount,
        Double avgScore,
        long lessonTotal,
        long lessonCompleted,
        String currentLessonTitle,
        LocalDateTime joinedAt,
        LocalDateTime createdAt
) {}
