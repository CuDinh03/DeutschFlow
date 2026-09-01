package com.deutschflow.teacher.dto;

/**
 * Bản xem trước 2 cột cho người duyệt (PR-6, AC09): dự báo trên LỊCH HIỆU LỰC vs dự báo NẾU ÁP
 * đề xuất (mô phỏng in-memory — không ghi DB). {@code projected} null với UPDATE_PATTERN
 * (mô phỏng regenerate ngoài phạm vi v1 — người duyệt đọc impact_snapshot).
 */
public record SchedulePreviewDto(
        ScheduleChangeRequestDto request,
        ScheduleForecastDto current,
        ScheduleForecastDto projected
) {}
