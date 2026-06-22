package com.deutschflow.teacher.dto;

import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Đặt/đổi lịch cố định cho một thứ trong tuần của lớp. Upsert theo (classId, dayOfWeek):
 * nếu đã có pattern cho thứ đó thì ghi đè, chưa có thì tạo mới.
 */
public record UpsertPatternRequest(
        short dayOfWeek,
        LocalTime startTime,
        int durationMinutes,
        String defaultMode,
        String defaultRoom,
        LocalDate effectiveFrom,
        LocalDate effectiveTo
) {}
