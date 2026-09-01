package com.deutschflow.teacher.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * Báo cáo 4 trục của một lớp (PR-10, spec §7): (1) nội dung đã dạy, (2) nhịp độ kế hoạch vs
 * thực tế, (3) tham gia, (4) đạt mục tiêu. Đọc-only — tổng hợp từ dữ liệu các PR trước, không
 * bảng mới.
 */
public record FourAxisReportDto(
        Long classId,
        Content content,
        Pacing pacing,
        Participation participation,
        Objectives objectives
) {
    /** Trục 1 — nội dung: mục giáo trình đã dạy đủ / tổng (PARTIAL đếm riêng). */
    public record Content(int taughtItems, int partialItems, int totalItems, int completedLessons, int totalLessons) {}

    /** Trục 2 — nhịp độ: dự báo từ phân bổ (PR-6) đặt cạnh mốc đã đặt. */
    public record Pacing(LocalDate projectedEndDate, int remainingMinutes, int availableMinutes,
                         int shortfallMinutes, int suggestedExtraSessions, int milestonesAtRisk) {}

    /** Trục 3 — tham gia: điểm danh tổng hợp + cờ cần-bù-riêng đang mở (PR-7/AC13). */
    public record Participation(long presentCount, long lateCount, long absentCount, long needsMakeupOpen,
                                int completedSessions, int totalPastSessions) {}

    /** Trục 4 — mục tiêu: phân bố trạng thái đánh giá (PR-9) + số học viên còn ô chưa đánh giá. */
    public record Objectives(long achieved, long needsPractice, long notAssessedCells, int totalObjectives,
                             List<String> studentsNeedingSupport) {}
}
