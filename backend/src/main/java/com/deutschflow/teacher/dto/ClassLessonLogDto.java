package com.deutschflow.teacher.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record ClassLessonLogDto(
        Long id,
        Long classId,
        LocalDate sessionDate,
        Integer sessionNumber,
        String topic,
        String homework,
        String note,
        LocalDateTime createdAt,
        List<AttendanceEntry> attendance,
        Long lessonId,
        String lessonTitle
) {
    public record AttendanceEntry(Long studentId, String name, String email, String status, String note) {}
}
