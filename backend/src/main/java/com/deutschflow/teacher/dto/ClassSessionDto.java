package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;

/** Một buổi học lớp, kèm tên lớp + sĩ số cho hiển thị lịch tuần. */
public record ClassSessionDto(
        Long id,
        Long classId,
        String className,
        Long patternId,
        String mode,
        String room,
        LocalDateTime startAt,
        int durationMinutes,
        String status,
        boolean overridden,
        int studentCount
) {}
