package com.deutschflow.teacher.dto;

import java.util.List;

/**
 * Điểm trung bình (đã chốt) theo tuần cho từng lớp — dữ liệu cho biểu đồ xu hướng ở trang
 * "Phân tích giảng dạy".
 *
 * <p>{@code buckets} là danh sách tuần ISO ("2026-W24") đã sắp xếp tăng dần và giới hạn ở các tuần
 * gần nhất. Mỗi {@link Series} là một lớp; {@code values[i]} ứng với {@code buckets[i]}, và bằng
 * null ở tuần lớp đó chưa có bài nào được chốt điểm (đường biểu đồ để hở đoạn đó).
 */
public record ClassTrendDto(
        List<String> buckets,
        List<Series> series
) {
    public record Series(Long classId, String className, List<Double> values) {}
}
