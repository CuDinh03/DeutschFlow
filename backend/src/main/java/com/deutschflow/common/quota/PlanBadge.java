package com.deutschflow.common.quota;

import java.time.Instant;

/**
 * Public-facing subscription tier for UI (no token usage).
 *
 * @param planCode Stored plan identifier (FREE, PRO, ULTRA, …).
 * @param tier Stable label for localization: BASIC, PREMIUM, or ULTRA.
 * @param startsAtUtc When the active subscription began (UTC instant), or {@code null} if unknown.
 * @param endsAtUtc Scheduled subscription end (exclusive of this instant per DB predicate); {@code null} if open-ended.
 */
public record PlanBadge(String planCode, String tier, Instant startsAtUtc, Instant endsAtUtc) {}
