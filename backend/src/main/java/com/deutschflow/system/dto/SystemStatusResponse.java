package com.deutschflow.system.dto;

import com.deutschflow.system.entity.MaintenanceWindow;

import java.time.Instant;
import java.time.ZoneOffset;

/**
 * Payload của {@code GET /api/public/system/status} — "đường dây nóng luôn trả lời":
 * 200 kể cả khi đang bảo trì (chính filter whitelist nó). Khi app CHẾT, nginx trả
 * 503 problem+json cùng ngữ nghĩa (tầng A) — client chỉ cần hiểu một cặp shape.
 *
 * @param status  {@code OK} | {@code MAINTENANCE} (MAINTENANCE ⇔ có window ACTIVE mode FULL)
 * @param serverTimeUtc client tính countdown bằng đồng hồ server, không tin đồng hồ máy
 */
public record SystemStatusResponse(
        String status,
        Instant serverTimeUtc,
        MaintenanceWindowPublicDto active,
        MaintenanceWindowPublicDto upcoming
) {

    /** Phần công khai của một window — không lộ cờ vận hành nội bộ. */
    public record MaintenanceWindowPublicDto(
            long id,
            String title,
            String note,
            String mode,
            Instant startsAtUtc,
            Instant endsAtUtc
    ) {
        public static MaintenanceWindowPublicDto from(MaintenanceWindow w) {
            if (w == null) {
                return null;
            }
            return new MaintenanceWindowPublicDto(
                    w.getId(),
                    w.getTitle(),
                    w.getNote(),
                    w.getMode().name(),
                    w.getStartsAt().toInstant(ZoneOffset.UTC),
                    w.getEndsAt() != null ? w.getEndsAt().toInstant(ZoneOffset.UTC) : null);
        }
    }
}
