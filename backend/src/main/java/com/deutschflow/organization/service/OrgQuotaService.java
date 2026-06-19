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

    /**
     * Tổng token AI org đã dùng trong tháng hiện tại — O(1) PK lookup từ counter table (S-3/P-10).
     * Counter được tăng atomic trong {@code AiUsageLedgerService.record()} mỗi khi có event.
     * Trả 0 nếu tháng này chưa có event nào (row chưa tồn tại).
     */
    @Transactional(readOnly = true)
    public long orgUsageThisMonth(Long orgId) {
        Long total = jdbcTemplate.query("""
                SELECT tokens_used FROM org_monthly_token_counters
                WHERE org_id = ?
                  AND month_start = date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
                """,
                rs -> rs.next() ? rs.getLong(1) : null,
                orgId);
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
     * {@code estimatedTokens} token trong tháng sẽ vượt pool. User B2C (không có org_members row)
     * và org pool {@code <= 0} → false (cho qua). Gọi từ {@code QuotaService.assertAllowed}.
     *
     * <p>Dùng {@code org_members} làm nguồn tenant duy nhất (T-1/D-1) — không đọc
     * {@code users.org_id} để tránh drift giữa hai nguồn.
     */
    @Transactional(readOnly = true)
    public boolean wouldExceedOrgPool(long userId, long estimatedTokens) {
        Long orgId = jdbcTemplate.query(
                "SELECT org_id FROM org_members WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1",
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
        long used = orgUsageThisMonth(orgId);
        maybeAlert80(orgId, pool, used, estimatedTokens);
        return exceeds(orgId, pool, used, estimatedTokens);
    }

    /**
     * Cảnh báo server-side khi org vừa CHẠM ngưỡng {@value #POOL_ALERT_PERCENT}% pool
     * (used dưới ngưỡng nhưng used + ước lượng vượt ngưỡng) — log một lần quanh thời điểm
     * vượt thay vì mỗi request. Frontend bắn {@code token_pool_threshold_80} cho PostHog;
     * log này là kênh ops/alert tương ứng phía backend.
     */
    private void maybeAlert80(Long orgId, long pool, long used, long estimatedTokens) {
        long threshold = (pool * POOL_ALERT_PERCENT) / 100L;
        long projected = used + Math.max(estimatedTokens, 0L);
        if (used < threshold && projected >= threshold) {
            log.warn("Org token pool alert: orgId={} đã đạt ~{}% pool (used={}, pool={})",
                    orgId, usagePercent(pool, projected), projected, pool);
        }
    }

    /** Pure decision (tách để test không cần mock JDBC). */
    static boolean exceeds(Long orgId, long pool, long used, long estimatedTokens) {
        if (orgId == null || pool <= 0L) {
            return false;
        }
        return used + Math.max(estimatedTokens, 0L) > pool;
    }

    /** Ngưỡng cảnh báo "sắp hết pool" — bắn alert/log khi org chạm mức này. */
    public static final int POOL_ALERT_PERCENT = 80;

    /**
     * % pool đã tiêu thụ trong tháng (0 khi pool {@code <= 0} = không giới hạn).
     * Có thể {@code > 100} khi đã vượt pool — caller tự clamp cho thanh tiến độ.
     */
    static int usagePercent(long pool, long used) {
        if (pool <= 0L) {
            return 0;
        }
        long clampedUsed = Math.max(used, 0L);
        return (int) Math.min(Integer.MAX_VALUE, (clampedUsed * 100L) / pool);
    }

    /** % pool đã dùng của org (đọc DB). 0 nếu org không có pool. */
    @Transactional(readOnly = true)
    public int usagePercent(Long orgId) {
        long pool = monthlyPool(orgId);
        if (pool <= 0L) {
            return 0;
        }
        return usagePercent(pool, orgUsageThisMonth(orgId));
    }
}
