package com.deutschflow.organization.dto;

/** Tóm tắt một tổ chức cho danh sách platform-admin. */
public record OrgDto(
        Long id,
        String name,
        String slug,
        String planCode,
        int seatLimit,
        String status,
        long memberCount,
        long studentCount
) {}
