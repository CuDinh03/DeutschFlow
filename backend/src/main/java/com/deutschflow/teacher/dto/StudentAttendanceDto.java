package com.deutschflow.teacher.dto;

import java.time.LocalDate;

/**
 * One session's attendance for the requesting student (their own record only).
 * {@code status} is null when the teacher has not marked this student for that session.
 */
public record StudentAttendanceDto(
        Long lessonLogId,
        LocalDate sessionDate,
        Integer sessionNumber,
        String topic,
        String status,   // PRESENT | ABSENT | LATE | null (not marked)
        String note
) {}
