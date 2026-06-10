package com.deutschflow.organization.dto;

import java.time.LocalDateTime;

/** Một lớp học thuộc tổ chức (read-only, query teacher_classes WHERE org_id). */
public record OrgClassDto(
        Long id,
        String name,
        String inviteCode,
        Long teacherId,
        LocalDateTime createdAt
) {}
