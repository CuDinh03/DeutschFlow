package com.deutschflow.organization.dto;

import java.time.Instant;

/**
 * Seat usage read (B2B model §4, D8: ghế = sức chứa HỌC VIÊN).
 * {@code remaining} is null when the org is unlimited (seatLimit = 0).
 */
public record OrgSeatUsageDto(
        long used,
        int limit,
        Long remaining,
        Instant validUntil
) {}
