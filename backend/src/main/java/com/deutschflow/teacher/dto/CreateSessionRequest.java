package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;

/** Thêm một buổi lớp lẻ (không theo pattern). Buổi tạo tay được đánh dấu overridden. */
public record CreateSessionRequest(
        LocalDateTime startAt,
        int durationMinutes,
        String mode,
        String room
) {}
