package com.deutschflow.organization.dto;

import java.util.List;

/**
 * Số liệu phân tích cho org-admin (GET /api/org/analytics).
 *
 * <p>{@code poolUnlimited = true} → org có cờ {@code pool_unlimited}, cho qua mọi AI call.
 * {@code poolUnlimited = false & monthlyTokenPool == 0} → org CHƯA cấu hình pool (V237 fail-safe, bị chặn).
 * {@code poolUnlimited = false & monthlyTokenPool > 0} → metered, xem {@code poolUsagePercent}.
 *
 * <p>{@code activeStudents7d}/{@code activeStudents30d} — "học viên hoạt động" theo DEC-20 (10/09/2026):
 * có NỘP BÀI hoặc ĐIỂM DANH có mặt trong cửa sổ; xem {@code OrgAnalyticsService#activeStudents}.
 * Tên trường {@code activeStudents7d} giữ nguyên (G1) dù định nghĩa đã đổi từ "có sự kiện AI".
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
        long activeStudents30d,
        List<CefrBucket> cefrDistribution
) {}
