package com.deutschflow.teacher.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * DTO cho kỳ công + quy trình duyệt (V264).
 *
 * <p>Không có trường nào về tiền: hệ chỉ chốt SỐ CÔNG rồi xuất ra ngoài cho kế toán.
 */
public final class TimesheetPeriodDtos {

    private TimesheetPeriodDtos() {}

    public record PeriodDto(
            Long id,
            Long teacherId,
            String teacherName,
            LocalDate periodStart,
            LocalDate periodEnd,
            String payUnit,
            String status,
            boolean editable,
            int totalSessions,
            int totalMinutes,
            Instant submittedAt,
            Instant reviewedAt,
            String rejectReason
    ) {}

    /** Tổng hợp toàn tổ chức trong một khoảng — màn hình manager. */
    public record OrgTimesheetDto(
            LocalDate from,
            LocalDate to,
            int teacherCount,
            int totalSessions,
            int totalMinutes,
            List<PeriodDto> periods
    ) {}

    public record ReviewRequest(String reason) {}
}
