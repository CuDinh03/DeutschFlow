package com.deutschflow.teacher.dto;

/**
 * Một dòng tổng hợp theo lớp cho trang "Phân tích giảng dạy": sĩ số, số bài đã giao và điểm
 * trung bình lớp (0 khi chưa có bài nào được chốt điểm). Trả về theo lô một lần cho toàn bộ lớp
 * của giáo viên — thay cho việc gọi báo cáo từng lớp (N+1).
 */
public record ClassSummaryDto(
        Long id,
        String name,
        long studentCount,
        long assignmentCount,
        double avgScore
) {}
