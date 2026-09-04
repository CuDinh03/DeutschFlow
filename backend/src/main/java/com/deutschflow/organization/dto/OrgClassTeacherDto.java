package com.deutschflow.organization.dto;

/**
 * Một giáo viên trong lớp nhìn từ console tổ chức ({@code class_teachers}):
 * PRIMARY = giáo viên phụ trách, ASSISTANT = trợ giảng.
 */
public record OrgClassTeacherDto(
        Long teacherId,
        String email,
        String displayName,
        String role
) {}
