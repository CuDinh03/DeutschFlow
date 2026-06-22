package com.deutschflow.organization.dto;

/**
 * Chi tiết một tổ chức (platform-admin xem 1 org).
 *
 * <p>{@code seatUsed} = số HỌC VIÊN ACTIVE (= {@code studentCount}); {@code monthlyTokenPool}
 * 0 = không giới hạn; {@code validUntil}/{@code createdAt} = ISO-8601 (null = vô thời hạn).
 */
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
        long seatUsed,
        long monthlyTokenPool,
        String validUntil,
        String createdAt
) {}
