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

        /** ISO-8601 future timestamp. Reserved for scheduled delivery (not yet supported). */
        String scheduledAt
) {
    public record Payload(
            @NotBlank String title,
            @NotBlank String body
    ) {}
}
