package com.deutschflow.organization.dto;

import java.util.List;

/**
 * Số liệu phân tích cho org-admin (GET /api/org/analytics).
 *
 * <p>{@code monthlyTokenPool == 0} nghĩa là org chưa cấu hình hạn mức (không giới hạn);
 * khi đó {@code poolUsagePercent} cũng = 0 và frontend hiển thị "chưa giới hạn".
 */
public record OrgAnalyticsDto(
        long studentCount,
        long teacherCount,
        long classCount,
        long tokensThisMonth,
        long monthlyTokenPool,
        int poolUsagePercent,
        long activeStudents7d,
        List<CefrBucket> cefrDistribution
) {}
