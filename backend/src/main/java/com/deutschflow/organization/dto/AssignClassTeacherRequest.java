package com.deutschflow.organization.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Org-admin (OWNER/MANAGER) đổi giáo viên phụ trách của một lớp đã tồn tại
 * (PATCH /api/org/classes/{id}/teacher). Giáo viên phải là thành viên TEACHER ACTIVE
 * của org (verify trong service để chống IDOR — không gán giáo viên org khác).
 */
public record AssignClassTeacherRequest(
        @NotNull(message = "teacherId is required") Long teacherId
) {}
