package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;

/**
 * Sửa một buổi (đổi giờ/thời lượng/hình thức/phòng/trạng thái). Các trường null = giữ nguyên,
 * RIÊNG {@code room} là ghi đè đầy đủ (null = xoá phòng, ví dụ khi chuyển sang ONLINE).
 */
public record UpdateSessionRequest(
        LocalDateTime startAt,
        Integer durationMinutes,
        String mode,
        String room,
        String status
) {}
