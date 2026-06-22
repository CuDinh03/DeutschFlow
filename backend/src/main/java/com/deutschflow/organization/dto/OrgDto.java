package com.deutschflow.organization.dto;

/**
 * Tóm tắt một tổ chức cho danh sách platform-admin.
 *
 * <p>{@code teacherCount}/{@code studentCount} đếm theo vai trò ACTIVE (role=TEACHER /
 * role=STUDENT), khớp với {@link OrgDetailDto}, {@link OrgSummaryDto}, {@link OrgAnalyticsDto}
 * và type {@code AdminOrg} ở frontend — "giáo viên" nhất quán ở mọi nơi (OWNER/ADMIN là tài
 * khoản vận hành, không tính vào head-count giáo viên/học viên).
 *
 * <p>{@code seatUsed} = số HỌC VIÊN ACTIVE (ghế đếm theo học viên, = {@code studentCount}).
 * {@code monthlyTokenPool} 0 = không giới hạn. {@code validUntil}/{@code createdAt} = ISO-8601
 * (Instant#toString), null khi vô thời hạn. Surface để admin hiện ghế/hạn dùng/pool token.
 */
public record OrgDto(
        Long id,
        String name,
        String slug,
        String planCode,
        int seatLimit,
        String status,
        long teacherCount,
        long studentCount,
        long seatUsed,
        long monthlyTokenPool,
        String validUntil,
        String createdAt
) {}
