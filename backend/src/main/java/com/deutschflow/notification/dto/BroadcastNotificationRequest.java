package com.deutschflow.notification.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

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
    public record Payload(
            @NotBlank String title,
            @NotBlank String body
    ) {}
}
