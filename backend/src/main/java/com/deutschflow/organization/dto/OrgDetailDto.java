package com.deutschflow.organization.dto;

import java.time.Instant;

/** Chi tiết một tổ chức (platform-admin xem 1 org). */
public record OrgDetailDto(
        Long id,
        String name,
        String slug,
        String planCode,
        int seatLimit,
        String status,
        long teacherCount,
        long studentCount,
        long pendingInvites,
        long monthlyTokenPool,
        boolean poolUnlimited,
        /** Hạn giấy phép; null = vô thời hạn khi còn ACTIVE (T-03). */
        Instant validUntil,
        /** Mốc bắt đầu đình chỉ — neo 7 ngày ân hạn; null = không bị đình chỉ (T-03). */
        Instant suspendedAt
) {}
