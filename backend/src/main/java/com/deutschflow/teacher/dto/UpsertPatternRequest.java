package com.deutschflow.teacher.dto;

import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Đặt/đổi lịch cố định cho một thứ trong tuần của lớp. Upsert theo (classId, dayOfWeek):
 * nếu đã có pattern cho thứ đó thì ghi đè, chưa có thì tạo mới.
 *
 * <p>PR-3 (D04): {@code teachingMinutes}/{@code breakMinutes} tách phút HỌC/NGHỈ khỏi phút
 * CHIẾM LỊCH ({@code durationMinutes}); null = chưa tách (BE tự suy: lớp trung tâm với buổi
 * 195' → 180+15, còn lại teaching = duration). Đã khai thì teaching + break phải = duration.
 */
public record UpsertPatternRequest(
        short dayOfWeek,
        LocalTime startTime,
        int durationMinutes,
        String defaultMode,
        String defaultRoom,
        LocalDate effectiveFrom,
        LocalDate effectiveTo,
        Integer teachingMinutes,
        Integer breakMinutes
) {
    /** Arity cũ (trước PR-3) — caller/test hiện có giữ nguyên; phút học/nghỉ để BE tự suy. */
    public UpsertPatternRequest(short dayOfWeek, LocalTime startTime, int durationMinutes,
                                String defaultMode, String defaultRoom,
                                LocalDate effectiveFrom, LocalDate effectiveTo) {
        this(dayOfWeek, startTime, durationMinutes, defaultMode, defaultRoom,
                effectiveFrom, effectiveTo, null, null);
    }
}
