package com.deutschflow.organization.dto;

/** Tổng quan "org của tôi" cho org-admin (GET /api/org). */
public record OrgSummaryDto(
        String name,
        String planCode,
        long seatUsed,
        int seatLimit,
        long teacherCount,
        long studentCount
) {}
