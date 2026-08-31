package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;

/** Một mục nội dung phân bổ vào buổi (PR-4, AC06). */
public record SessionContentDto(
        Long id,
        Long sessionId,
        Long classLessonId,
        String lessonTitle,
        Long curriculumItemId,
        String itemText,
        int orderIndex,
        Integer plannedMinutes,
        String status,
        Integer actualMinutes,
        Integer remainingMinutes,
        Long carriedFromId,
        LocalDateTime confirmedAt,
        String note
) {}
