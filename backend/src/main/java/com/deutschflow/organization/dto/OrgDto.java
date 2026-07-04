package com.deutschflow.organization.dto;

/**
 * Tóm tắt một tổ chức cho danh sách platform-admin.
 *
 * <p>{@code teacherCount}/{@code studentCount} đếm theo vai trò ACTIVE (role=TEACHER /
 * role=STUDENT), khớp với {@link OrgDetailDto}, {@link OrgSummaryDto}, {@link OrgAnalyticsDto}
 * và type {@code AdminOrg} ở frontend — "giáo viên" nhất quán ở mọi nơi (OWNER/MANAGER là tài
 * khoản vận hành, không tính vào head-count giáo viên/học viên).
 */
public record OrgDto(
        Long id,
        String name,
        String slug,
        String planCode,
        int seatLimit,
        String status,
        long teacherCount,
        long studentCount
) {}
