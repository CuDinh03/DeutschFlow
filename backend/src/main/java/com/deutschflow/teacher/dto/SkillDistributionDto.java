package com.deutschflow.teacher.dto;

/**
 * Phân bố 4 kỹ năng (thang 0–10) trung bình trên toàn bộ học viên của giáo viên — dữ liệu cho
 * biểu đồ kỹ năng ở trang "Phân tích giảng dạy". Mỗi trường null khi chưa có học viên nào được
 * chấm kỹ năng đó. {@code ratedCount} là số học viên có ít nhất một điểm kỹ năng.
 */
public record SkillDistributionDto(
        Double horen,
        Double lesen,
        Double schreiben,
        Double sprechen,
        long ratedCount
) {}
