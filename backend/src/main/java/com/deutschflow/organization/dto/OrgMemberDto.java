package com.deutschflow.organization.dto;

import java.time.Instant;

/** Một thành viên trong tổ chức (OWNER|ADMIN|TEACHER|STUDENT). */
public record OrgMemberDto(
        Long userId,
        String email,
        String displayName,
        String role,
        String status,
        Instant joinedAt
) {}
