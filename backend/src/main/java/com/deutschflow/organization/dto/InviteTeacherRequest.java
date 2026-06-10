package com.deutschflow.organization.dto;

/** Mời giáo viên vào tổ chức qua email (org-admin). */
public record InviteTeacherRequest(
        String email
) {}
