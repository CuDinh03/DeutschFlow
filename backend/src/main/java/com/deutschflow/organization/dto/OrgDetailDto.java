package com.deutschflow.organization.dto;

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
        long pendingInvites
) {}
