package com.deutschflow.organization.dto;

import java.time.Instant;
import java.util.List;

/**
 * Chi tiết một học viên thuộc tổ chức (B1.2) — membership + các lớp đang theo học
 * (lọc theo org). Read-only, org-admin.
 */
public record OrgStudentDetailDto(
        Long userId,
        String email,
        String displayName,
        String role,
        String status,
        Instant joinedAt,
        List<OrgStudentClassDto> classes
) {}
