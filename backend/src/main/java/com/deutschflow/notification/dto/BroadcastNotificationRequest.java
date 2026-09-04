package com.deutschflow.notification.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record BroadcastNotificationRequest(

        /** Optional notification type override. Defaults to ADMIN_BROADCAST if blank. */
        String type,

        /** ALL | TIER | ROLE | SINGLE_USER */
        @NotBlank String audienceType,

        /** Required when audienceType = TIER. E.g. FREE, PRO, PREMIUM. */
        String tier,

        /** Required when audienceType = ROLE. E.g. STUDENT, TEACHER, ADMIN. */
        String role,

        /** Required when audienceType = SINGLE_USER. */
        String targetEmail,

        @NotNull @Valid Payload payload,

        /**
         * Optional ISO-8601 timestamp. When set to a future time the broadcast is queued
         * for delivery by ScheduledBroadcastJob; otherwise it is delivered immediately.
         */
        String scheduledAt
) {
    /**
     * C1/F-M9 (03/09/2026): {@code @Size} chặn payload khổng lồ ngay tại biên — mỗi broadcast nhân
     * bản title/body vào N hàng {@code user_notifications} (payload JSONB) và N push Expo, nên một
     * body vài MB nhân với toàn bộ user là phình DB + vỡ push. 200/2000 dư cho một thông báo thật.
     */
    public record Payload(
            @NotBlank @Size(max = 200) String title,
            @NotBlank @Size(max = 2000) String body
    ) {}
}
