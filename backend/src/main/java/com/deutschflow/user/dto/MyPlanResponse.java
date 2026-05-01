package com.deutschflow.user.dto;

import java.time.Instant;

/**
 * Subscription visible to learners: plan identifier and coarse tier only (no token counts).
 *
 * @param planCode Stored code (FREE, PRO, ULTRA, …).
 * @param tier     BASIC | PREMIUM | ULTRA — localize on the client.
 * @param startsAtUtc Beginning of active subscription assignment (nullable).
 * @param endsAtUtc   Scheduled subscription end instant, exclusive; {@code null} if no end date.
 */
public record MyPlanResponse(String planCode, String tier, Instant startsAtUtc, Instant endsAtUtc) {}
