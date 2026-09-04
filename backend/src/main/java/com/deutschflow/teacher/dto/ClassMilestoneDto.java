package com.deutschflow.teacher.dto;

import java.time.LocalDate;

/** Mốc của lớp (V295) — kèm {@code pendingRequestId} khi việc DỜI ngày vào hàng chờ duyệt (P05). */
public record ClassMilestoneDto(
        Long id,
        Long classId,
        String kind,
        String title,
        LocalDate plannedDate,
        String note,
        Long pendingRequestId
) {}
