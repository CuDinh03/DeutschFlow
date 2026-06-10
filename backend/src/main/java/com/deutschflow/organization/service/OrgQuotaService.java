package com.deutschflow.organization.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Hạn mức token AI cấp-org (monthly pool): vừa báo cáo, vừa enforcement.
 *
 * <p>{@code monthly_token_pool <= 0} nghĩa là KHÔNG giới hạn. {@link #wouldExceedOrgPool}
 * được {@code QuotaService.assertAllowed} gọi để chặn khi tổng tiêu thụ của org vượt pool;
 * người dùng B2C (không thuộc org) và org chưa cấu hình pool luôn cho qua → B2C không đổi.
 */
@Service
@Slf4j
public class OrgQuotaService {

    private final JdbcTemplate jdbcTemplate;

    public OrgQuotaService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /** Tổng token AI org đã dùng trong tháng hiện tại (mọi user thuộc org). */
    @Transactional(readOnly = true)
    public long orgUsageThisMonth(Long orgId) {
        Long total = jdbcTemplate.queryForObject("""
                SELECT COALESCE(SUM(e.total_tokens), 0)
                FROM ai_token_usage_events e
                JOIN users u ON u.id = e.user_id
                WHERE u.org_id = ?
                  AND e.created_at >= date_trunc('month', now())
                """, Long.class, orgId);
        return total != null ? total : 0L;
    }

    /** Hạn mức token/tháng cấp cho org (0 = không giới hạn). */
    @Transactional(readOnly = true)
    public long monthlyPool(Long orgId) {
        Long pool = jdbcTemplate.queryForObject(
                "SELECT COALESCE(monthly_token_pool, 0) FROM organizations WHERE id = ?",
                Long.class, orgId);
        return pool != null ? pool : 0L;
    }

    /** Token còn lại trong tháng. Pool {@code <= 0} (không giới hạn) → {@link Long#MAX_VALUE}. */
    @Transactional(readOnly = true)
    public long remainingPool(Long orgId) {
        long pool = monthlyPool(orgId);
        if (pool <= 0) {
            return Long.MAX_VALUE;
        }
        long remaining = pool - orgUsageThisMonth(orgId);
        return Math.max(remaining, 0L);
    }

    /**
     * True nếu user thuộc một org có pool {@code > 0} và việc nạp thêm
     * {@code estimatedTokens} token trong tháng sẽ vượt pool. User B2C (org_id NULL) và
     * org pool {@code <= 0} → false (cho qua). Gọi từ {@code QuotaService.assertAllowed}.
     */
    @Transactional(readOnly = true)
    public boolean wouldExceedOrgPool(long userId, long estimatedTokens) {
        Long orgId = jdbcTemplate.query(
                "SELECT org_id FROM users WHERE id = ?",
                rs -> {
                    if (!rs.next()) {
                        return null;
                    }
                    long v = rs.getLong(1);
                    return rs.wasNull() ? null : v;
                },
                userId);
        if (orgId == null) {
            return false; // không thuộc org nào
        }
        long pool = monthlyPool(orgId);
        if (pool <= 0L) {
            return false; // pool chưa cấu hình → bỏ qua truy vấn SUM tốn kém
        }
        return exceeds(orgId, pool, orgUsageThisMonth(orgId), estimatedTokens);
    }

    /** Pure decision (tách để test không cần mock JDBC). */
    static boolean exceeds(Long orgId, long pool, long used, long estimatedTokens) {
        if (orgId == null || pool <= 0L) {
            return false;
        }
        return used + Math.max(estimatedTokens, 0L) > pool;
    }
}
