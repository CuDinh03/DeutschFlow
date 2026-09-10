package com.deutschflow.organization.dto;

import java.time.Instant;

/**
 * Tóm tắt một tổ chức cho danh sách platform-admin.
 *
 * <p>{@code teacherCount}/{@code studentCount} đếm theo vai trò ACTIVE (role=TEACHER /
 * role=STUDENT), khớp với {@link OrgDetailDto}, {@link OrgSummaryDto}, {@link OrgAnalyticsDto}
 * và type {@code AdminOrg} ở frontend — "giáo viên" nhất quán ở mọi nơi (OWNER/MANAGER là tài
 * khoản vận hành, không tính vào head-count giáo viên/học viên).
 *
 * <p>{@code validUntil}/{@code suspendedAt}/pool (T-03, 10/09/2026): màn danh sách admin đã in
 * "Gia hạn {date}" từ trước nhưng DTO này chưa từng mang {@code validUntil} — cột đó luôn "—".
 * Bổ sung để danh sách nói đúng hạn giấy phép và hạn mức AI của từng trung tâm.
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
        /** Hạn giấy phép; null = vô thời hạn khi còn ACTIVE. */
        Instant validUntil,
        /** Mốc bắt đầu đình chỉ (neo 7 ngày ân hạn); null = không bị đình chỉ. */
        Instant suspendedAt,
        long monthlyTokenPool,
        boolean poolUnlimited
) {}
