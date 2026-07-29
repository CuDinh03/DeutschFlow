package com.deutschflow.organization.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Hạn mức token AI cấp-org (monthly pool): vừa báo cáo, vừa enforcement.
 *
 * <p><b>2 kênh token (đã quyết 26/07):</b> pool trung tâm CHỈ dành cho staff org
 * ({@code role != 'STUDENT'} trong {@code org_members} — OWNER/MANAGER/TEACHER). Học viên org đi kênh
 * VÍ CÁ NHÂN (entitlement từ gói org hoặc tự mua IAP) và {@link #tryReserve} trả
 * {@link OrgReservation#NONE} như B2C — GV chấm hàng loạt không bao giờ chặn/trừ vào phần học viên
 * và ngược lại (P0-01/P0-02).
 *
 * <p>Bảng quyết định cho STAFF (V237 / M-5 / P-14), khớp {@link com.deutschflow.common.quota.FreeTierGuard#orgMemberCapped}:
 * <ul>
 *   <li>B2C (không thuộc org) hoặc STUDENT → cho qua, không giữ gì.</li>
 *   <li>{@code pool_unlimited = true} → unlimited THẬT, cho qua.</li>
 *   <li>{@code pool_unlimited = false & monthly_token_pool > 0} → metered theo pool.</li>
 *   <li>{@code pool_unlimited = false & pool = 0} → CHƯA cấu hình → cap (fail-safe, đóng backdoor).</li>
 * </ul>
 * {@link #tryReserve} được {@code QuotaService.assertAllowed} và {@code OrgPoolGuard} gọi để chặn
 * (H-3: reserve-then-reconcile, không còn check-then-act).
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
     * Suất giữ chỗ trong pool token tháng của org, tạo bởi {@link #tryReserve} tại gate và
     * đối soát tại charge ({@code AiUsageLedgerService}).
     *
     * @param orgId          org của user tại thời điểm gate; {@code null} = B2C (không giữ gì)
     * @param reservedTokens số token đã CỘNG TRƯỚC vào counter (0 với B2C / unlimited / est=0)
     */
    public record OrgReservation(Long orgId, long reservedTokens) {
        /** B2C / không có gì để giữ. */
        public static final OrgReservation NONE = new OrgReservation(null, 0L);

        /** true khi thật sự có token đã cộng trước vào counter (cần reconcile/refund). */
        public boolean metered() {
            return orgId != null && reservedTokens > 0L;
        }
    }

    /**
     * H-3 (audit B2B 07-04) — đóng TOCTOU của gate pool org bằng <b>reserve-then-reconcile</b>:
     * thay vì "đọc usage rồi quyết" (N request đồng thời cùng lách), token ước lượng được CỘNG
     * TRƯỚC vào counter bằng MỘT câu conditional-upsert atomic; hết chỗ → {@code Optional.empty()}
     * (caller ném 429). Charge thật sau LLM chỉ ghi phần chênh (delta = actual − reserved) qua
     * {@code AiUsageLedgerService}; request chết trước khi charge được filter cuối request hoàn trả
     * ({@code OrgReservationRefundFilter}).
     *
     * <p>Bảng quyết định (xem class doc): B2C, STUDENT org (kênh ví cá nhân) và {@code unlimited}
     * → cho qua không giữ gì; {@code pool=0 & !unlimited} → cap fail-safe (P-14); metered → giữ
     * chỗ atomic.
     *
     * <p>{@code REQUIRES_NEW}: suất giữ phải COMMIT ngay khi method trả về để mọi request đồng thời
     * nhìn thấy — kể cả khi caller ({@code QuotaService.assertAllowed}) đang ở transaction read-only.
     *
     * <p>Dùng {@code org_members} (status ACTIVE) làm nguồn tenant duy nhất (T-1/D-1/M-5) —
     * không đọc {@code users.org_id} để tránh drift giữa hai nguồn.
     *
     * <p>Biên tháng: reserve sát nửa đêm cuối tháng rồi refund/charge rơi sang tháng mới sẽ đối soát
     * vào row tháng mới (row cũ giữ phần est lẻ) — lệch một-request chấp nhận được, tự hết khi sang kỳ.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<OrgReservation> tryReserve(long userId, long estimatedTokens) {
        OrgMembership membership = resolveActiveMembership(userId);
        if (membership == null || !membership.staff()) {
            // B2C, hoặc HỌC VIÊN org (kênh 1 — ví cá nhân; pool trung tâm không gate, không trừ).
            return Optional.of(OrgReservation.NONE);
        }
        return reserveForOrg(membership.orgId(), estimatedTokens);
    }

    /**
     * Biến thể cho caller ĐÃ resolve membership (tránh query org_members lần hai trên hot-path
     * {@code QuotaService.assertAllowed}). Cùng ngữ nghĩa {@code REQUIRES_NEW} với
     * {@link #tryReserve(long, long)} — suất giữ phải commit ngay khi trả về.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<OrgReservation> tryReserveForOrg(long orgId, long estimatedTokens) {
        return reserveForOrg(orgId, estimatedTokens);
    }

    private Optional<OrgReservation> reserveForOrg(long orgId, long estimatedTokens) {
        OrgPoolConfig cfg = loadPoolConfig(orgId);
        long est = Math.max(estimatedTokens, 0L);
        if (cfg.unlimited()) {
            return Optional.of(new OrgReservation(orgId, 0L));
        }
        if (cfg.pool() <= 0L) {
            if (est == 0L) {
                return Optional.of(new OrgReservation(orgId, 0L));
            }
            // pool = 0 & !unlimited → org CHƯA cấu hình ngân sách → cap (V237 fail-safe; đóng backdoor
            // P-14/M-5, trước đây pool=0 bị coi là "unlimited"). ⚠ Cần chạy deploy-gate (set
            // pool_unlimited=true / pool>0 cho org hợp lệ) TRƯỚC deploy — xem audit/prod_verify_section6.sql (ITEM 5).
            log.warn("[OrgPool][P-14] Chặn AI: orgId={} chưa cấu hình pool token (pool=0, pool_unlimited=false). "
                    + "Set monthly_token_pool>0 hoặc bật pool_unlimited qua admin.", orgId);
            return Optional.empty();
        }
        if (est == 0L) {
            return Optional.of(new OrgReservation(orgId, 0L)); // không tiêu thụ ước lượng → không giữ chỗ
        }
        if (est > cfg.pool()) {
            return Optional.empty(); // một request đã lớn hơn cả pool — chặn không cần đụng counter
        }
        // MỘT câu atomic: row chưa có → INSERT est (an toàn vì est <= pool); row đã có → chỉ cộng khi
        // không vượt pool. 0 row trả về = hết chỗ. Không còn khe đọc-rồi-quyết cho request khác chen.
        Long newUsed = jdbcTemplate.query("""
                        INSERT INTO org_monthly_token_counters (org_id, month_start, tokens_used)
                        VALUES (?, date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, ?)
                        ON CONFLICT (org_id, month_start) DO UPDATE
                            SET tokens_used = org_monthly_token_counters.tokens_used + EXCLUDED.tokens_used
                            WHERE org_monthly_token_counters.tokens_used + EXCLUDED.tokens_used <= ?
                        RETURNING tokens_used
                        """,
                rs -> rs.next() ? rs.getLong(1) : null,
                orgId, est, cfg.pool());
        if (newUsed == null) {
            log.warn("[OrgPool][H-3] Hết pool: orgId={} không còn chỗ cho est={} (pool={})",
                    orgId, est, cfg.pool());
            return Optional.empty();
        }
        maybeAlert80(orgId, cfg.pool(), newUsed - est, est);
        return Optional.of(new OrgReservation(orgId, est));
    }

    /**
     * Hoàn trả suất giữ chỗ chưa được charge tiêu thụ (request lỗi trước LLM, LLM ném exception,
     * hoặc gate async đã nhường việc charge cho job). {@code GREATEST(..., 0)} chống âm khi counter
     * bị chỉnh tay giữa chừng. No-op cho reservation không metered.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void refund(OrgReservation reservation) {
        if (reservation == null || !reservation.metered()) {
            return;
        }
        jdbcTemplate.update("""
                        UPDATE org_monthly_token_counters
                           SET tokens_used = GREATEST(tokens_used - ?, 0)
                         WHERE org_id = ?
                           AND month_start = date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
                        """,
                reservation.reservedTokens(), reservation.orgId());
    }

    /**
     * Membership ACTIVE của user trong org, kèm vai trò — RANH GIỚI duy nhất của 2 kênh token
     * (26/07): {@code role = STUDENT} → kênh ví cá nhân; mọi role khác → kênh pool trung tâm.
     */
    public record OrgMembership(long orgId, String role) {
        /** Kênh 2 (pool trung tâm): OWNER/MANAGER/TEACHER — mọi vai trò trừ STUDENT. */
        public boolean staff() {
            return !"STUDENT".equals(role);
        }
    }

    /**
     * Membership ACTIVE của user theo {@code org_members} (nguồn tenant duy nhất — T-1/D-1/M-5);
     * {@code null} = B2C. User thuộc ≥2 org: ưu tiên membership STAFF trước STUDENT rồi tie-break
     * {@code org_id} nhỏ nhất — thay cho {@code LIMIT 1} không ORDER BY mơ hồ trước đây.
     * Không mở transaction riêng: một SELECT, join tx của caller (gate read-only lẫn charge read-write).
     */
    public OrgMembership resolveActiveMembership(long userId) {
        return jdbcTemplate.query("""
                        SELECT org_id, role FROM org_members
                        WHERE user_id = ? AND status = 'ACTIVE'
                        ORDER BY (role = 'STUDENT'), org_id
                        LIMIT 1
                        """,
                rs -> rs.next() ? new OrgMembership(rs.getLong(1), rs.getString(2)) : null,
                userId);
    }

    /**
     * {@code true} khi org ĐÃ được cấp ngân sách AI (unlimited hoặc pool > 0) — caller dùng để chọn
     * mã lỗi {@code ORG_BUDGET_EXHAUSTED} (đã cạn) vs {@code ORG_BUDGET_NOT_CONFIGURED} (chưa cấu
     * hình) khi {@link #tryReserve} trả empty. Chỉ chạy trên đường lỗi — không tốn hot-path.
     */
    public boolean isPoolConfigured(long orgId) {
        OrgPoolConfig cfg = loadPoolConfig(orgId);
        return cfg.unlimited() || cfg.pool() > 0L;
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

    /** Trả về {@code true} nếu org được đặt {@code pool_unlimited = true}. */
    public boolean isPoolUnlimited(Long orgId) {
        return loadPoolConfig(orgId).unlimited();
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
