package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;

/**
 * Sửa một buổi (đổi giờ/thời lượng/hình thức/phòng/trạng thái). Các trường null = giữ nguyên,
 * RIÊNG {@code room} là ghi đè đầy đủ (null = xoá phòng, ví dụ khi chuyển sang ONLINE).
 *
 * <p>PR-3 (D04): gửi {@code teachingMinutes}/{@code breakMinutes} để tách/đổi phút học-nghỉ
 * (teaching + break phải = duration sau thay đổi). Buổi ĐÃ tách phút mà đổi durationMinutes
 * thì bắt buộc gửi kèm hai trường này — BE không tự chia lại.
 */
public record UpdateSessionRequest(
        LocalDateTime startAt,
        Integer durationMinutes,
        String mode,
        String room,
        String status,
        Integer teachingMinutes,
        Integer breakMinutes
) {
    /** Arity cũ (trước PR-3) — caller/test hiện có giữ nguyên. */
    public UpdateSessionRequest(LocalDateTime startAt, Integer durationMinutes, String mode,
                                String room, String status) {
        this(startAt, durationMinutes, mode, room, status, null, null);
    }
}
