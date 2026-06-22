package com.deutschflow.organization.dto;

/**
 * Mời nhân sự vào tổ chức qua email (org-admin).
 *
 * <p>{@code role} tuỳ chọn — chỉ nhận MANAGER/TEACHER (validate ở service); null/blank ⇒ TEACHER.
 */
public record InviteTeacherRequest(
        String email,
        String role
) {}
