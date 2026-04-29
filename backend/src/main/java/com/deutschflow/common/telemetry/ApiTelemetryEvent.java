package com.deutschflow.common.telemetry;

import java.time.LocalDateTime;

public record ApiTelemetryEvent(
        String eventName,
        LocalDateTime eventTime,
        Long userId,
        String sessionId,
        String role,
        String requestId,
        String method,
        String endpoint,
        int statusCode,
        long latencyMs,
        boolean error
) {
}
