package com.deutschflow.organization.dto;

import java.util.List;

/**
 * Số liệu phân tích cho org-admin (GET /api/org/analytics).
 *
 * <p>{@code poolUnlimited = true} → org có cờ {@code pool_unlimited}, cho qua mọi AI call.
 * {@code poolUnlimited = false & monthlyTokenPool == 0} → org CHƯA cấu hình pool (V237 fail-safe, bị chặn).
 * {@code poolUnlimited = false & monthlyTokenPool > 0} → metered, xem {@code poolUsagePercent}.
 */
public record OrgAnalyticsDto(
        long studentCount,
        long teacherCount,
        long classCount,
        long tokensThisMonth,
        long monthlyTokenPool,
        int poolUsagePercent,
        boolean poolUnlimited,
        long activeStudents7d,
        List<CefrBucket> cefrDistribution
) {}
