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
        Long lessonId,
        Long sessionId
) {
    /** Arity cũ (trước PR-4) — caller/test hiện có giữ nguyên; sessionId để BE tự suy theo ngày. */
    public CreateLessonLogRequest(LocalDate sessionDate, Integer sessionNumber, String topic,
                                  String homework, String note, List<AttendanceInput> attendance,
                                  Long lessonId) {
        this(sessionDate, sessionNumber, topic, homework, note, attendance, lessonId, null);
    }

    public record AttendanceInput(Long studentId, String status, String note) {}
}
