package com.deutschflow.organization.dto;

import java.util.List;

/** Số liệu phân tích cho org-admin (GET /api/org/analytics). */
public record OrgAnalyticsDto(
        long studentCount,
        long teacherCount,
        long classCount,
        long tokensThisMonth,
        long activeStudents7d,
        List<CefrBucket> cefrDistribution
) {}
