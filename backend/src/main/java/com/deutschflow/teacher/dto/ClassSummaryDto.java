package com.deutschflow.teacher.dto;

/**
 * Một dòng tổng hợp theo lớp cho trang "Phân tích giảng dạy": sĩ số, số bài đã giao và điểm
 * trung bình lớp. {@code avgScore} là NULL khi lớp chưa có bài nào được chốt điểm (F05): 0.0 là
 * một điểm trung bình THẬT, không phải giá trị canh gác — trước đây FE phải dùng {@code > 0} để
 * đoán "chưa có dữ liệu" và vì thế một lớp điểm 0 thật biến mất khỏi biểu đồ.
 */
public record ClassSummaryDto(
        Long id,
        String name,
        long studentCount,
        long assignmentCount,
        Double avgScore
) {}
