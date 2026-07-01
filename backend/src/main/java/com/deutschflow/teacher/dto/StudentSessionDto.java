package com.deutschflow.teacher.dto;

import java.time.LocalDateTime;

/**
 * One class session as shown to a student (P5): when, how long, mode, room, and status.
 * Read-only; no teacher-internal fields (pattern/override/roster).
 */
public record StudentSessionDto(
        Long id,
        LocalDateTime startAt,
        int durationMinutes,
        String mode,     // ONLINE | OFFLINE
        String room,
        String status    // SCHEDULED | CANCELLED | MOVED
) {}
