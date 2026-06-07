package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;
import java.util.List;

public record MyClassroomDto(
        Long id,
        String name,
        List<TeacherSummaryDto> teachers,
        long assignmentCount,
        long pendingCount,
        long submittedCount,
        long gradedCount,
        Double avgScore,
        String latestAssignmentTopic,
        LocalDateTime latestAssignmentDueDate,
        long lessonTotal,
        long lessonCompleted,
        LocalDateTime joinedAt
) {}
