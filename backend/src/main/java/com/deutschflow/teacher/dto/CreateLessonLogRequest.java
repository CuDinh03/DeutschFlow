package com.deutschflow.teacher.dto;

import java.time.LocalDate;
import java.util.List;

public record CreateLessonLogRequest(
        LocalDate sessionDate,
        Integer sessionNumber,
        String topic,
        String homework,
        String note,
        List<AttendanceInput> attendance,
        Long lessonId
) {
    public record AttendanceInput(Long studentId, String status, String note) {}
}
