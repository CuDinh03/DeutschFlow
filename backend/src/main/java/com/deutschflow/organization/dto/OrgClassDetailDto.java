package com.deutschflow.organization.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Chi tiết một lớp thuộc tổ chức (B1.1) — query {@code teacher_classes} WHERE org_id,
 * kèm tên giáo viên + roster học viên (read-only, org-admin).
 */
public record OrgClassDetailDto(
        Long id,
        String name,
        String inviteCode,
        Long teacherId,
        String teacherName,
        LocalDateTime createdAt,
        int studentCount,
        List<OrgClassStudentDto> students
) {}
