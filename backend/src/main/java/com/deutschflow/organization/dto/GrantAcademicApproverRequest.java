package com.deutschflow.organization.dto;

/** Gán quyền duyệt học vụ — scope ORG (classId null) hoặc CLASS (classId bắt buộc). OWNER-only. */
public record GrantAcademicApproverRequest(
        Long userId,
        String scope,
        Long classId
) {}
