package com.deutschflow.system.dto;

import com.deutschflow.system.entity.MaintenanceWindow;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

/** Bản đầy đủ của một window cho admin console (kèm cờ vận hành + mốc đã gửi thông báo). */
public record MaintenanceWindowDto(
        long id,
        String title,
        String note,
        String mode,
        String status,
        Instant startsAtUtc,
        Instant endsAtUtc,
        boolean autoActivate,
        boolean autoComplete,
        Instant notifiedScheduleAtUtc,
        Instant notifiedBeforeAtUtc,
        Instant notifiedCompleteAtUtc,
        String createdBy,
        Instant createdAtUtc,
        Instant updatedAtUtc
) {
    public static MaintenanceWindowDto from(MaintenanceWindow w) {
        return new MaintenanceWindowDto(
                w.getId(),
                w.getTitle(),
                w.getNote(),
                w.getMode().name(),
                w.getStatus().name(),
                utc(w.getStartsAt()),
                utc(w.getEndsAt()),
                w.isAutoActivate(),
                w.isAutoComplete(),
                utc(w.getNotifiedScheduleAt()),
                utc(w.getNotifiedBeforeAt()),
                utc(w.getNotifiedCompleteAt()),
                w.getCreatedBy(),
                utc(w.getCreatedAt()),
                utc(w.getUpdatedAt()));
    }

    private static Instant utc(LocalDateTime ldt) {
        return ldt != null ? ldt.toInstant(ZoneOffset.UTC) : null;
    }
}
