package com.deutschflow.teacher.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * Dự báo tiến độ lớp theo phân bổ (PR-6, AC09/AC17): còn bao nhiêu phút nội dung bắt buộc, lịch
 * tương lai gánh được bao nhiêu, học xong dự kiến vào buổi nào; thiếu khung thì BÁO thiếu + nhu
 * cầu bổ sung — hệ thống không tự tạo lịch, không bỏ bài, không tự dời mốc.
 */
public record ScheduleForecastDto(
        /** Tổng phút nội dung giáo trình CHƯA dạy xong (PARTIAL tính phần còn lại). */
        int remainingMinutes,
        /** Tổng phút HỌC của các buổi tương lai còn hiệu lực. */
        int availableMinutes,
        int futureSessionCount,
        /** Ngày của buổi mà lũy kế phút học phủ hết nội dung — null khi thiếu khung. */
        LocalDate projectedEndDate,
        /** Phút còn thiếu sau khi dùng hết buổi tương lai (0 = đủ). */
        int shortfallMinutes,
        /** Ước số buổi 180′ cần bổ sung để phủ phần thiếu (AC17 — chỉ là nhu cầu hiển thị). */
        int suggestedExtraSessions,
        List<MilestoneView> milestones
) {
    /** Mốc lớp kèm cờ rủi ro: nội dung dự kiến chưa xong trước ngày mốc (hoặc thiếu khung). */
    public record MilestoneView(Long id, String kind, String title, LocalDate plannedDate,
                                String note, boolean atRisk) {}
}
