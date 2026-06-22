package com.deutschflow.teacher.dto;

import java.time.LocalDate;
import java.time.LocalTime;

/** Lịch cố định của một lớp (một dòng mỗi thứ trong tuần). */
public record ClassSchedulePatternDto(
        Long id,
        Long classId,
        short dayOfWeek,
        LocalTime startTime,
        int durationMinutes,
        String defaultMode,
        String defaultRoom,
        LocalDate effectiveFrom,
        LocalDate effectiveTo
) {}
