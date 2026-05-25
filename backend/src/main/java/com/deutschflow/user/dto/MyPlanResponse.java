package com.deutschflow.user.dto;

import java.time.Instant;

/**
 * User subscription plan response.
 * Contains plan details visible to the client via /api/auth/me/plan endpoint.
 *
 * @param planCode Stored plan identifier (FREE, PRO, ULTRA, …).
 * @param tier Stable label for localization: BASIC, PREMIUM, or ULTRA.
 * @param startsAtUtc When the active subscription began (UTC instant), or null if unknown.
 * @param endsAtUtc Scheduled subscription end (exclusive); null if open-ended.
 */
public record MyPlanResponse(
    String planCode,
    String tier,
    Instant startsAtUtc,
    Instant endsAtUtc
) {}
