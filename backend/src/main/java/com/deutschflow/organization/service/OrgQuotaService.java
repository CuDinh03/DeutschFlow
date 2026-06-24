package com.deutschflow.organization.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Hạn mức token AI cấp-org (monthly pool): vừa báo cáo, vừa enforcement.
 *
 * <p>Bảng quyết định (V237 / M-5 / P-14), khớp {@link com.deutschflow.common.quota.FreeTierGuard#orgMemberCapped}:
 * <ul>
 *   <li>B2C (không thuộc org) → cho qua (không đổi).</li>
 *   <li>{@code pool_unlimited = true} → unlimited THẬT, cho qua.</li>
 *   <li>{@code pool_unlimited = false & monthly_token_pool > 0} → metered theo pool.</li>
 *   <li>{@code pool_unlimited = false & pool = 0} → CHƯA cấu hình → cap (fail-safe, đóng backdoor).</li>
 * </ul>
 * {@link #wouldExceedOrgPool} được {@code QuotaService.assertAllowed} và {@code OrgPoolGuard} gọi để chặn.
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
     * True nếu việc nạp thêm {@code estimatedTokens} cho user này sẽ vượt hạn mức org (xem bảng quyết
     * định ở class doc). User B2C (không có {@code org_members} row) → false. Gọi từ
     * {@code QuotaService.assertAllowed} và {@code OrgPoolGuard}.
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
            return false; // không thuộc org nào (B2C)
        }
        OrgPoolConfig cfg = loadPoolConfig(orgId);
        boolean metered = !cfg.unlimited() && cfg.pool() > 0L;
        // Chỉ query usage khi thực sự metered (O(1) counter lookup); unlimited / pool=0 không cần.
        long used = metered ? orgUsageThisMonth(orgId) : 0L;
        boolean blocked = poolBlocks(cfg.pool(), cfg.unlimited(), used, estimatedTokens);
        if (metered) {
            maybeAlert80(orgId, cfg.pool(), used, estimatedTokens);
        } else if (blocked) {
            // pool = 0 & !unlimited → org CHƯA cấu hình ngân sách → cap (V237 fail-safe; đóng backdoor
            // P-14/M-5, trước đây pool=0 bị coi là "unlimited"). ⚠ Cần chạy deploy-gate (set
            // pool_unlimited=true / pool>0 cho org hợp lệ) TRƯỚC deploy — xem audit/prod_verify_section6.sql (ITEM 5).
            log.warn("[OrgPool][P-14] Chặn AI: orgId={} chưa cấu hình pool token (pool=0, pool_unlimited=false). "
                    + "Set monthly_token_pool>0 hoặc bật pool_unlimited qua admin.", orgId);
        }
        return blocked;
    }

    /**
     * Quyết định thuần (bảng V237 — xem class doc), tách để test không cần JDBC, khớp
     * {@link com.deutschflow.common.quota.FreeTierGuard#orgMemberCapped}:
     * {@code unlimited} → cho qua; {@code pool<=0 & !unlimited} → cap (bất kỳ tiêu thụ dương nào);
     * {@code pool>0} → metered ({@code used + est > pool}).
     */
    static boolean poolBlocks(long pool, boolean unlimited, long used, long estimatedTokens) {
        if (unlimited) {
            return false;
        }
        long est = Math.max(estimatedTokens, 0L);
        if (pool <= 0L) {
            return est > 0L;
        }
        return used + est > pool;
    }

    /** Cấu hình pool của org (pool + cờ unlimited) trong 1 query. Org không tồn tại → fail-safe (0, false) = cap. */
    private OrgPoolConfig loadPoolConfig(Long orgId) {
        return jdbcTemplate.query(
                "SELECT COALESCE(monthly_token_pool, 0), pool_unlimited FROM organizations WHERE id = ?",
                rs -> rs.next()
                        ? new OrgPoolConfig(rs.getLong(1), rs.getBoolean(2))
                        : new OrgPoolConfig(0L, false),
                orgId);
    }

    private record OrgPoolConfig(long pool, boolean unlimited) {}

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
