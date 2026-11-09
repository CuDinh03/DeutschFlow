package com.deutschflow.admin.dto;

import java.util.List;
import java.util.Map;

/**
 * DTO của danh bạ người dùng admin (đợt 1 "Nền móng + Người dùng", 09/11/2026).
 *
 * <p>Record thay cho {@code Map<String,Object>}: endpoint cũ {@code GET /admin/users} trả khoá
 * chữ thường ({@code displayname}, {@code isactive}) vì Postgres hạ alias không có ngoặc kép, và
 * frontend phải đọc cả hai dạng. Ở đây tên khoá JSON là tên field — camelCase cố định.
 */
public final class AdminUserDirectoryDtos {

    private AdminUserDirectoryDtos() {
    }

    /** Hạn mức AI tại thời điểm đọc (cùng phép tính với {@code GET /admin/users/{id}/quota}). */
    public record QuotaView(
            String kind,
            boolean unlimited,
            long monthlyTokenLimit,
            long remainingThisMonth,
            long walletBalance,
            long walletCap,
            long dailyTokenGrant,
            long usedToday
    ) {
    }

    /** Một dòng của danh sách người dùng. */
    public record UserRow(
            long id,
            String email,
            String displayName,
            String role,
            boolean isActive,
            String createdAt,
            Long orgId,
            String orgName,
            String planCode,
            long usageLast30Days,
            QuotaView quota
    ) {
    }

    /** Trang kết quả: {@code page} đánh số từ 0, {@code sort} là chuỗi đã chuẩn hoá ("createdAt,desc"). */
    public record UserSearchPage(
            List<UserRow> items,
            long total,
            int page,
            int size,
            String sort
    ) {
    }

    /** Người dùng tiêu nhiều token nhất 30 ngày (đã loại tài khoản demo). */
    public record TopUsageUser(
            long id,
            String email,
            String displayName,
            String role,
            long usageLast30Days
    ) {
    }

    /** Thống kê cho KPI trang Người dùng / Tổng quan / Chi phí AI — đếm trên CẢ bảng, không trên trang đang xem. */
    public record UserStats(
            long total,
            long active,
            long locked,
            Map<String, Long> byRole,
            long aiActive30d,
            long freeTeachers,
            List<TopUsageUser> topUsage30d
    ) {
    }

    /** Phần đầu trang hồ sơ {@code /v2/admin/users/{id}}. */
    public record UserProfile(
            long id,
            String email,
            String displayName,
            String role,
            boolean isActive,
            String createdAt,
            String locale,
            Long orgId,
            String orgName,
            String planCode,
            String subscriptionStartsAtUtc,
            String subscriptionEndsAtUtc
    ) {
    }
}
