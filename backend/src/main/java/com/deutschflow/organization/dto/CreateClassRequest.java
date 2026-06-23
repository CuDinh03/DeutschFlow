package com.deutschflow.organization.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Org-admin (OWNER/MANAGER) tạo lớp cho trung tâm (G-3 follow-up).
 * teacherId bắt buộc: cột {@code teacher_classes.teacher_id} là NOT NULL, nên mỗi lớp
 * phải có một giáo viên phụ trách. Giáo viên phải là thành viên TEACHER ACTIVE của org
 * (verify trong service để chống IDOR — không gán giáo viên org khác).
 */
public record CreateClassRequest(
        @NotBlank(message = "name is required")
        @Size(max = 120, message = "name must be at most 120 characters")
        String name,
        @NotNull(message = "teacherId is required") Long teacherId
) {}
