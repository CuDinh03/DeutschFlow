package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;

/**
 * Thêm một buổi lớp lẻ (không theo pattern). Buổi tạo tay được đánh dấu overridden.
 *
 * <p>PR-3 (D04): {@code teachingMinutes}/{@code breakMinutes} tách phút HỌC/NGHỈ; null = BE tự
 * suy (lớp trung tâm buổi 195' → 180+15, còn lại teaching = duration). Buổi bù của lớp trung tâm
 * phải đủ 180+15 như buổi chính (AC21 — luồng đề xuất/duyệt siết ở PR-5).
 */
public record CreateSessionRequest(
        LocalDateTime startAt,
        int durationMinutes,
        String mode,
        String room,
        Integer teachingMinutes,
        Integer breakMinutes
) {
    /** Arity cũ (trước PR-3) — caller/test hiện có giữ nguyên. */
    public CreateSessionRequest(LocalDateTime startAt, int durationMinutes, String mode, String room) {
        this(startAt, durationMinutes, mode, room, null, null);
    }
}
