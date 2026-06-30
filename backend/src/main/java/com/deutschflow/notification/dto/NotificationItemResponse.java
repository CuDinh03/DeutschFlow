package com.deutschflow.notification.dto;

import com.deutschflow.notification.NotificationType;

import java.time.Instant;
import java.util.Map;

/**
 * A single notification for the client. {@code title}/{@code body} are rendered
 * server-side (see NotificationContentRenderer) so every surface — web, mobile,
 * and the OS push — shows identical, recorded content. {@code payload} is kept
 * for structured deep-link data (ids, codes) the client may need for routing.
 */
public record NotificationItemResponse(
        long id,
        NotificationType type,
        String title,
        String body,
        Map<String, Object> payload,
        boolean read,
        Instant createdAtUtc
) {}
