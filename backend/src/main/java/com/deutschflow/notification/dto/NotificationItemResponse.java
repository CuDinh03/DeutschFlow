package com.deutschflow.notification.dto;

import com.deutschflow.notification.NotificationType;

import java.time.Instant;
import java.util.Map;

public record NotificationItemResponse(
        long id,
        NotificationType type,
        Map<String, Object> payload,
        boolean read,
        Instant createdAtUtc
) {}
