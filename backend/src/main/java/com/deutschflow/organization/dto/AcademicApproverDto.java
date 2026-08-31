package com.deutschflow.organization.dto;

import java.time.LocalDateTime;

/** Một phân công người duyệt học vụ đang hiệu lực (PR-2, P01). */
public record AcademicApproverDto(
        Long id,
        Long userId,
        String displayName,
        String email,
        String orgRole,
        String scope,
        Long classId,
        String className,
        LocalDateTime grantedAt
) {}
