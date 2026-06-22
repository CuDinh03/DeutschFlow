package com.deutschflow.organization.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Org-admin (OWNER/MANAGER) pre-create giáo viên (B2B model §2.1, Phase 1 NOW).
 * Tạo thẳng account TEACHER + membership (không qua invite). Danh tính person-owned & portable.
 */
public record CreateTeacherRequest(
        @NotBlank(message = "email is required") String email,
        @NotBlank(message = "displayName is required") String displayName,
        @NotBlank(message = "password is required") String password
) {}
