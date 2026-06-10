package com.deutschflow.organization.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reporting-only view của hạn mức token AI cấp-org (monthly pool).
 *
 * <p>Phase này CHỈ phục vụ báo cáo (admin/analytics); KHÔNG can thiệp vào luồng
 * gate AI cốt lõi. {@code monthly_token_pool <= 0} nghĩa là không giới hạn.
 *
 * <p>TODO: wire pre-check into QuotaService.assertAllowed as a follow-up.
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
}
