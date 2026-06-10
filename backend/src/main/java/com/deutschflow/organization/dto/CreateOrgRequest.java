package com.deutschflow.organization.dto;

/** Tạo tổ chức mới (platform-admin). */
public record CreateOrgRequest(
        String name,
        String slug,
        String planCode,
        Integer seatLimit,
        String ownerEmail
) {}
