package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;
import java.util.Map;

/** Một đề xuất thay đổi lịch (PR-5) — dùng cho cả màn giáo viên lẫn hàng chờ duyệt của org. */
public record ScheduleChangeRequestDto(
        Long id,
        Long classId,
        String className,
        String requestType,
        Map<String, Object> payload,
        Map<String, Object> impactSnapshot,
        String reason,
        boolean hasWeekend,
        String status,
        Long requestedBy,
        String requestedByName,
        LocalDateTime requestedAt,
        Long reviewedBy,
        LocalDateTime reviewedAt,
        String rejectReason,
        LocalDateTime appliedAt
) {}
