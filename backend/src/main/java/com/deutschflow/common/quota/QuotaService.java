package com.deutschflow.common.quota;

import com.deutschflow.organization.service.OrgQuotaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.List;
import java.util.Objects;
import org.springframework.jdbc.core.RowCallbackHandler;

@Slf4j
@Service
@RequiredArgsConstructor
public class QuotaService {

    private static final String PLAN_DEFAULT = "DEFAULT";
    private static final String PLAN_FREE = "FREE";
    private static final String PLAN_PRO = "PRO";
    private static final String PLAN_ULTRA = "ULTRA";
    private static final String PLAN_INTERNAL = "INTERNAL";

    private final JdbcTemplate jdbcTemplate;
    private final OrgQuotaService orgQuotaService;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public QuotaSnapshot getSnapshot(long userId, Instant now) {
        return buildSnapshot(userId, now);
    }

    /**
     * Read-only quota view for dashboards (admin user list): no subscription reconciliation writes,
     * no wallet INSERT/UPDATE, joins the caller transaction ({@code REQUIRED} — not {@code REQUIRES_NEW}).
     */
    @Transactional(readOnly = true, propagation = Propagation.REQUIRED)
    public QuotaSnapshot getSnapshotReadOnly(long userId, Instant now) {
        return buildSnapshotReadOnly(userId, now);
    }

    /**
     * Batch read-only snapshots for ONE PAGE of the admin user list (đợt 1 admin, 09/11/2026).
     *
     * <p>{@link #getSnapshotReadOnly} costs 2–4 queries per user; the old {@code GET /admin/users}
     * called it for every user in the table (≈4N+2 queries). This runs exactly three queries for the
     * whole page — active subscription, today's usage, wallet — and feeds the SAME pure function
     * ({@link #snapshotFrom}) the single-user path uses, so the two can never disagree on the wallet
     * accrual math. Users without an active covering subscription get the DEFAULT empty snapshot.
     *
     * @return snapshot per requested id, in the iteration order of {@code userIds} (duplicates/null dropped)
     */
    @Transactional(readOnly = true, propagation = Propagation.REQUIRED)
    public Map<Long, QuotaSnapshot> getSnapshotsReadOnly(Collection<Long> userIds, Instant now) {
        if (userIds == null || userIds.isEmpty()) {
            return Map.of();
        }
        List<Long> ids = userIds.stream().filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        String in = String.join(",", Collections.nCopies(ids.size(), "?"));
        Timestamp nowTs = Timestamp.from(now);

        Map<Long, SubscriptionRow> subs = new HashMap<>();
        List<Object> subArgs = new ArrayList<>(ids);
        subArgs.add(nowTs);
        subArgs.add(nowTs);
        // Same predicate + tie-break as loadActiveCoveringSubscription, one row per user.
        jdbcTemplate.query("""
                        SELECT DISTINCT ON (us.user_id)
                               us.user_id AS uid,
                               us.id AS sid,
                               us.plan_code AS plan_code,
                               us.starts_at AS starts_at,
                               us.ends_at AS ends_at,
                               COALESCE(us.monthly_token_limit_override, sp.daily_token_grant) AS daily_grant_raw,
                               sp.wallet_cap_days AS wallet_cap_days,
                               us.source AS source
                        FROM user_subscriptions us
                        JOIN subscription_plans sp ON sp.code = us.plan_code
                        WHERE us.user_id IN (%s)
                          AND us.status = 'ACTIVE'
                          AND sp.is_active
                          AND us.starts_at <= ?
                          AND (us.ends_at IS NULL OR us.ends_at > ?)
                        ORDER BY us.user_id, us.starts_at DESC, us.id DESC
                        """.formatted(in),
                (RowCallbackHandler) rs -> {
                    Timestamp startsTs = rs.getTimestamp("starts_at");
                    Timestamp endsTs = rs.getTimestamp("ends_at");
                    subs.put(rs.getLong("uid"), new SubscriptionRow(
                            rs.getLong("sid"),
                            rs.getString("plan_code"),
                            startsTs == null ? Instant.EPOCH : startsTs.toInstant(),
                            endsTs == null ? null : endsTs.toInstant(),
                            toLong(rs.getObject("daily_grant_raw")),
                            toInt(rs.getObject("wallet_cap_days")),
                            rs.getString("source")));
                },
                subArgs.toArray());

        Instant[] vn = QuotaVnCalendar.vnDayBoundsInclusiveExclusive(now);
        Map<Long, Long> usedToday = new HashMap<>();
        List<Object> usageArgs = new ArrayList<>(ids);
        usageArgs.add(Timestamp.from(vn[0]));
        usageArgs.add(Timestamp.from(vn[1]));
        jdbcTemplate.query("""
                        SELECT user_id, COALESCE(SUM(total_tokens), 0) AS used
                        FROM ai_token_usage_events
                        WHERE user_id IN (%s)
                          AND created_at >= ?
                          AND created_at < ?
                        GROUP BY user_id
                        """.formatted(in),
                (RowCallbackHandler) rs -> usedToday.put(rs.getLong("user_id"), rs.getLong("used")),
                usageArgs.toArray());

        Map<Long, Long> balances = new HashMap<>();
        Map<Long, LocalDate> lastAccrual = new HashMap<>();
        jdbcTemplate.query(
                "SELECT user_id, balance, last_accrual_local_date FROM user_ai_token_wallets WHERE user_id IN (%s)"
                        .formatted(in),
                (RowCallbackHandler) rs -> {
                    long uid = rs.getLong("user_id");
                    balances.put(uid, rs.getLong("balance"));
                    Date d = rs.getDate("last_accrual_local_date");
                    if (d != null) {
                        lastAccrual.put(uid, d.toLocalDate());
                    }
                },
                ids.toArray());

        Map<Long, QuotaSnapshot> out = new LinkedHashMap<>();
        for (Long id : ids) {
            out.put(id, snapshotFrom(subs.get(id), usedToday.getOrDefault(id, 0L),
                    lastAccrual.get(id), balances.getOrDefault(id, 0L), now));
        }
        return out;
    }

    /**
     * Hot-path quota gate: read-only snapshot (no reconcile writes) so Hikari pool is not saturated
     * under concurrent AI requests (S-4). FREE trial expiry is enforced via a 7-day virtual check;
     * background {@code SubscriptionReconcileJob} handles the actual DB state update.
     *
     * <p><b>P-9 — soft-cap có chủ đích (KHÔNG phải hard cap):</b> đây là bước CHECK đọc-thuần,
     * tách rời với bước DEBIT ({@link #applyUsageDebit}) chạy SAU lời gọi LLM (cách nhau 2-10s).
     * Vì vậy N request đồng thời của cùng một user đều có thể pass check trước khi request đầu
     * tiên kịp debit → overage tối đa ≈ (số request đồng thời) × (token/request). Đây là đánh đổi
     * có chủ đích ở cấp <b>per-user</b> (ví cá nhân), đã bị chặn trên bởi {@code AiRateLimiterService}
     * (req/window/user); symptom của overage được ghi ở {@link #applyUsageDebit}
     * (marker {@code [Quota][P-9/P-11][OVERAGE]}) để log-based alert đếm được.
     *
     * <p><b>Cấp ORG thì KHÁC (H-3, 2026-07-23):</b> pool org là hạn mức doanh thu/COGS theo hợp đồng
     * nên là <b>hard-cap thật</b> — {@code OrgQuotaService.tryReserveForOrg} cộng trước est vào counter
     * bằng một câu conditional-upsert atomic (commit REQUIRES_NEW ngay tại gate), charge sau LLM chỉ
     * ghi delta, đường chết được {@code OrgReservationRefundFilter} hoàn trả.
     *
     * <p><b>2 kênh token (đã quyết 26/07):</b> ranh giới duy nhất là {@code org_members.role} —
     * <ul>
     *   <li><b>Staff org</b> (OWNER/MANAGER/TEACHER): chạy 100% bằng pool trung tâm. BỎ QUA toàn bộ
     *       khối ví cá nhân (trial-expiry, remainingSpendable) — GV hết trial/ví 0đ không còn bị
     *       chặn oan trước khi chạm pool (Q1).</li>
     *   <li><b>STUDENT org + B2C</b>: chỉ ví cá nhân — pool trung tâm không gate, không trừ
     *       (P0-01: HV/PRO hết cảnh chết vì pool org chưa cấu hình).</li>
     * </ul>
     */
    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    public QuotaSnapshot assertAllowed(long userId, Instant nowUtc, long estimatedMinTokens) {
        com.deutschflow.common.security.support.SupportSessionContextHolder.assertNotSupportSession("quota");
        QuotaSnapshot snap = buildSnapshotReadOnly(userId, nowUtc);
        if (snap.unlimitedInternal()) {
            return snap;
        }
        OrgQuotaService.OrgMembership membership = orgQuotaService.resolveActiveMembership(userId);
        if (membership != null && membership.staff()) {
            return assertStaffPoolAllowed(membership, estimatedMinTokens, snap);
        }
        // ── Kênh 1: ví cá nhân (STUDENT org + B2C) ──
        // Virtual 7-day FREE trial expiry — DB reconcile is async (SubscriptionReconcileJob);
        // gating must not allow AI access to users whose trial expired but ends_at is not yet set.
        if (PLAN_FREE.equals(snap.planCode())
                && snap.subscriptionEndsAtUtc() == null
                && snap.subscriptionStartsAtUtc() != null
                && !nowUtc.isBefore(snap.subscriptionStartsAtUtc().plus(7, ChronoUnit.DAYS))) {
            throw new QuotaExceededException("Gói dùng thử 7 ngày đã hết hạn. Hãy nâng cấp để tiếp tục.", snap);
        }
        if (snap.remainingSpendable() <= 0L) {
            throw new QuotaExceededException("AI token quota exceeded.", snap);
        }
        if (estimatedMinTokens > 0L && snap.remainingSpendable() < estimatedMinTokens) {
            throw new QuotaExceededException("Not enough AI token quota remaining for this request.", snap);
        }
        return snap;
    }

    /**
     * Kênh 2 — staff org: gate DUY NHẤT là pool trung tâm (H-3 reserve atomic trong tx REQUIRES_NEW
     * riêng; suất giữ chỗ được charge đối soát delta hoặc {@code OrgReservationRefundFilter} hoàn trả
     * nếu request chết). Khi pool chặn, mã lỗi tách "đã cạn" vs "chưa cấu hình" — client hiển thị
     * "liên hệ quản trị trung tâm", không mời nâng cấp gói cá nhân (P0-02).
     */
    private QuotaSnapshot assertStaffPoolAllowed(OrgQuotaService.OrgMembership membership,
                                                 long estimatedMinTokens,
                                                 QuotaSnapshot snap) {
        var reservation = orgQuotaService.tryReserveForOrg(membership.orgId(), estimatedMinTokens)
                .orElseThrow(() -> orgQuotaService.isPoolConfigured(membership.orgId())
                        ? QuotaExceededException.orgBudgetExhausted(snap)
                        : QuotaExceededException.orgBudgetNotConfigured(snap));
        if (reservation.metered()) {
            OrgReservationHolder.replace(reservation, orgQuotaService::refund);
        }
        return snap;
    }

    /** Called by {@code SubscriptionReconcileJob} to run subscription lifecycle cleanup per user. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void reconcileForUser(long userId, Instant now) {
        reconcileSubscriptions(userId, now);
    }

    /** Giá trị {@code user_subscriptions.source} của gói do provisioner cấp lúc đăng ký. */
    static final String SOURCE_TRIAL = "TRIAL";
    /** Quyền lợi do TRUNG TÂM cấp — client phải ẩn huỷ/hoàn tiền Apple (V-06). */
    static final String SOURCE_ORG = "ORG";
    /** Quyền lợi mua qua In-App Purchase — huỷ/hoàn tiền là chuyện của Apple. */
    static final String SOURCE_APPLE = "APPLE";
    /** Mọi ngả còn lại (TRIAL, DEFAULT, UNKNOWN, SePay/Stripe/MoMo…) gộp về một nhãn cho client. */
    static final String SOURCE_WEB = "WEB";

    /**
     * Chuẩn hoá {@code user_subscriptions.source} thô về ba nhãn client hiểu được.
     * Cố ý KHÔNG rò các giá trị nội bộ (UNKNOWN, DEFAULT, SEPAY…) ra hợp đồng công khai.
     */
    static String publicSource(String rawSource) {
        if (SOURCE_ORG.equals(rawSource)) return SOURCE_ORG;
        if (SOURCE_APPLE.equals(rawSource)) return SOURCE_APPLE;
        return SOURCE_WEB;
    }

    @Transactional
    public PlanBadge resolvePlanBadge(long userId, Instant nowUtc) {
        // Phiên hỗ trợ chỉ-đọc: chỉ đọc huy hiệu, không chạy đối soát (UPDATE/INSERT) thay người dùng —
        // connection của request hỗ trợ là READ ONLY nên đối soát sẽ nổ. Job nền vẫn đối soát như thường.
        if (!com.deutschflow.common.security.support.SupportSessionContextHolder.isActive()) {
            reconcileSubscriptions(userId, nowUtc);
        }
        SubscriptionRow row = loadActiveCoveringSubscription(userId, nowUtc);
        if (row == null) {
            return new PlanBadge(PLAN_DEFAULT, publicTier(PLAN_DEFAULT), null, null, false, null, SOURCE_WEB);
        }
        return new PlanBadge(
                row.planCode(), publicTier(row.planCode()), row.startsAt(), row.endsAtExclusive(),
                row.isTrial(), row.isTrial() ? row.endsAtExclusive() : null, publicSource(row.source()));
    }

    /**
     * After {@link AiUsageLedgerService} inserts a ledger row — debits rollover wallet on PRO/ULTRA.
     */
    /** Joins caller transaction when present so ledger + debit stay consistent. */
    @Transactional(propagation = Propagation.REQUIRED)
    public void applyUsageDebit(long userId, long totalTokens, Instant now) {
        if (totalTokens <= 0) {
            return;
        }
        SubscriptionRow row = loadActiveCoveringSubscription(userId, now);
        if (row == null) {
            return;
        }
        if (PLAN_INTERNAL.equals(row.planCode)) {
            return;
        }
        if (!isWalletPlan(row.planCode)) {
            return;
        }

        ensureWalletRow(userId);
        // B5 (xác nhận prod 26/07, user 96): PHẢI cộng dồn ví tới hôm nay TRƯỚC khi trừ.
        // Đường gate hot-path dùng buildSnapshotReadOnly — tính số dư ẢO mà không ghi; đường ghi
        // accrual duy nhất trước đây là buildSnapshot, vốn chỉ được Admin/Weekly gọi. Hệ quả:
        // user mới (trial PRO, chưa ai accrue ví) qua gate với 400k ảo, nhưng debit chạy trên ví
        // THẬT 0đ → GREATEST(0, 0−n)=0 → remaining<=0 → downgradePaidPlansToDefault ngay lần
        // dùng AI đầu tiên (chuỗi STT→[OVERAGE] balance=0→DEFAULT khớp cùng giây 07:32:23).
        // Áp cho MỌI ngả cấp gói ví (trial đăng ký, IAP, SePay, org entitlement) tại một chỗ.
        long accrualDailyGrant = Math.max(0L, row.dailyGrant());
        int accrualCapDays = Math.max(0, row.walletCapDays());
        accrueWalletThroughToday(userId, row, accrualCapDays > 0 ? accrualCapDays * accrualDailyGrant : 0L, now);
        Long currentBalance = jdbcTemplate.queryForObject(
                "SELECT balance FROM user_ai_token_wallets WHERE user_id = ?", Long.class, userId);
        long walletBalance = currentBalance != null ? currentBalance : 0L;
        if (totalTokens > walletBalance) {
            // Stable marker for log-based alerting/metric — symptom of P-9 soft-cap races
            // (concurrent requests racing past assertAllowed) and P-11 wallet clamp absorbing overage.
            log.warn("[Quota][P-9/P-11][OVERAGE] userId={} consumed={} balance={} overage={}",
                    userId, totalTokens, walletBalance, totalTokens - walletBalance);
        }
        jdbcTemplate.update(
                """
                        UPDATE user_ai_token_wallets SET balance = GREATEST(0, balance - ?), updated_at = CURRENT_TIMESTAMP
                        WHERE user_id = ?
                        """,
                totalTokens, userId);

        Long balance = jdbcTemplate.queryForObject(
                "SELECT balance FROM user_ai_token_wallets WHERE user_id = ?", Long.class, userId);
        long remaining = balance == null ? 0L : balance;
        if (remaining <= 0L) {
            // Quyết định owner 10/11/2026 (mở rộng Q2 28/08 từ trial sang MỌI gói ví): ví cạn giữa kỳ
            // thì KHÔNG hạ gói. Ví được cấp theo ngày, nên cạn hôm nay là chuyện bình thường — lần cộng
            // ví hôm sau sẽ nạp lại. Người dùng giữ PRO/ULTRA tới hết kỳ; chỉ các chức năng dùng AI
            // tạm dừng (gate assertAllowed chặn khi remainingSpendable <= 0). Trước đây nhánh này hạ
            // về DEFAULT và xoá ví: người trả tiền dùng hết hạn mức ngày đầu mất luôn phần còn lại
            // của kỳ. Gói chỉ kết thúc khi ends_at đã qua (reconcileExpiredPaidWithWallet).
            // Giữ dòng ví ở balance = 0 để accrueWalletThroughToday có mốc last_accrual mà cộng tiếp.
            log.info("[Quota][WALLET_EMPTY] userId={} plan={} ví cạn, gói còn hạn tới {} — giữ nguyên gói, AI tạm dừng tới lần cộng ví kế tiếp",
                    userId, row.planCode(), row.endsAtExclusive());
        }
    }

    private QuotaSnapshot buildSnapshotReadOnly(long userId, Instant now) {
        SubscriptionRow row = loadActiveCoveringSubscription(userId, now);
        if (row == null) {
            return emptySnapshot(now, PLAN_DEFAULT);
        }

        Instant[] vn = QuotaVnCalendar.vnDayBoundsInclusiveExclusive(now);
        long usedToday = sumUsageBetween(userId, vn[0], vn[1]);

        LocalDate lastAccruedTo = null;
        long currentBalance = 0L;
        if (isWalletPlan(row.planCode)) {
            lastAccruedTo = loadWalletLastAccrualLocalDate(userId);
            currentBalance = loadWalletBalanceOrZero(userId);
        }
        return snapshotFrom(row, usedToday, lastAccruedTo, currentBalance, now);
    }

    /**
     * Pure read-only snapshot math (no JDBC) — shared by {@link #getSnapshotReadOnly} and the batch
     * {@link #getSnapshotsReadOnly} so both paths compute the wallet accrual identically.
     *
     * @param row            active covering subscription, or {@code null} → DEFAULT empty snapshot
     * @param lastAccruedTo  wallet {@code last_accrual_local_date} (only read for PRO/ULTRA)
     * @param currentBalance wallet {@code balance} as stored (only read for PRO/ULTRA)
     */
    static QuotaSnapshot snapshotFrom(SubscriptionRow row, long usedToday, LocalDate lastAccruedTo,
                                      long currentBalance, Instant now) {
        if (row == null) {
            return emptySnapshot(now, PLAN_DEFAULT);
        }
        Instant[] vn = QuotaVnCalendar.vnDayBoundsInclusiveExclusive(now);

        long dailyGrant = Math.max(0L, row.dailyGrant);
        int capDays = Math.max(0, row.walletCapDays);
        long walletCap = capDays > 0 ? capDays * dailyGrant : 0L;

        if (PLAN_INTERNAL.equals(row.planCode)) {
            return new QuotaSnapshot(
                    PLAN_INTERNAL,
                    true,
                    vn[0], vn[1],
                    dailyGrant,
                    usedToday,
                    0L,
                    0L,
                    999_999_999L,
                    row.startsAt(),
                    row.endsAtExclusive()
            );
        }

        if (isWalletPlan(row.planCode)) {
            long walletBalance = computeAccruedWalletBalance(subscriptionStartLocalDate(row), lastAccruedTo, walletCap,
                    dailyGrant, QuotaVnCalendar.localDateOf(now), currentBalance);
            long remaining = Math.max(0L, walletBalance);
            return new QuotaSnapshot(
                    row.planCode,
                    false,
                    vn[0], vn[1],
                    dailyGrant,
                    usedToday,
                    walletBalance,
                    walletCap,
                    remaining,
                    row.startsAt(),
                    row.endsAtExclusive()
            );
        }

        if (PLAN_FREE.equals(row.planCode)) {
            long remaining = Math.max(0L, dailyGrant - usedToday);
            return new QuotaSnapshot(
                    PLAN_FREE,
                    false,
                    vn[0], vn[1],
                    dailyGrant,
                    usedToday,
                    0L,
                    0L,
                    remaining,
                    row.startsAt(),
                    row.endsAtExclusive()
            );
        }

        return new QuotaSnapshot(
                row.planCode(),
                false,
                vn[0], vn[1],
                0L,
                usedToday,
                0L,
                0L,
                0L,
                row.startsAt(),
                row.endsAtExclusive()
        );
    }

    private static LocalDate subscriptionStartLocalDate(SubscriptionRow row) {
        return QuotaVnCalendar.localDateOf(row.startsAt);
    }

    private LocalDate loadWalletLastAccrualLocalDate(long userId) {
        List<LocalDate> rows = jdbcTemplate.query(
                "SELECT last_accrual_local_date FROM user_ai_token_wallets WHERE user_id = ? LIMIT 1",
                (rs, rowNum) -> {
                    Date ddb = rs.getDate(1);
                    return ddb == null ? null : ddb.toLocalDate();
                },
                userId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private long loadWalletBalanceOrZero(long userId) {
        List<Long> rows = jdbcTemplate.query(
                "SELECT balance FROM user_ai_token_wallets WHERE user_id = ? LIMIT 1",
                (rs, rowNum) -> rs.getLong(1),
                userId);
        return rows.isEmpty() ? 0L : rows.get(0);
    }

    /**
     * Pure accrual math shared with {@link #accrueWalletThroughToday} (no JDBC writes).
     */
    private static long computeAccruedWalletBalance(LocalDate subscriptionStart,
                                                    LocalDate lastAccruedTo,
                                                    long walletCap,
                                                    long dailyGrant,
                                                    LocalDate today,
                                                    long currentBalance) {
        LocalDate baseline = subscriptionStart.minusDays(1);
        LocalDate from = baseline;
        if (lastAccruedTo != null) {
            LocalDate normalized = lastAccruedTo.isBefore(subscriptionStart.minusDays(1))
                    ? subscriptionStart.minusDays(1)
                    : lastAccruedTo;
            from = normalized;
        }

        long balance = currentBalance;
        long daily = Math.max(0L, dailyGrant);

        long spanDays = Math.max(0L, ChronoUnit.DAYS.between(from, today));
        if (walletCap <= 0L || daily <= 0L || spanDays <= 0L) {
            return Math.min(balance, walletCap);
        }

        if (balance >= walletCap) {
            return walletCap;
        }
        double deficit = walletCap - balance;
        long pullsNeeded = (long) Math.ceil(deficit / (double) daily);
        long pulls = Math.min(spanDays, pullsNeeded);
        return Math.min(walletCap, balance + pulls * daily);
    }

    private QuotaSnapshot buildSnapshot(long userId, Instant now) {
        reconcileSubscriptions(userId, now);
        SubscriptionRow row = loadActiveCoveringSubscription(userId, now);
        if (row == null) {
            return emptySnapshot(now, PLAN_DEFAULT);
        }

        Instant[] vn = QuotaVnCalendar.vnDayBoundsInclusiveExclusive(now);
        long usedToday = sumUsageBetween(userId, vn[0], vn[1]);

        long dailyGrant = Math.max(0L, row.dailyGrant);
        int capDays = Math.max(0, row.walletCapDays);
        long walletCap = capDays > 0 ? capDays * dailyGrant : 0L;

        if (PLAN_INTERNAL.equals(row.planCode)) {
            return new QuotaSnapshot(
                    PLAN_INTERNAL,
                    true,
                    vn[0], vn[1],
                    dailyGrant,
                    usedToday,
                    0L,
                    0L,
                    999_999_999L,
                    row.startsAt(),
                    row.endsAtExclusive()
            );
        }

        if (isWalletPlan(row.planCode)) {
            ensureWalletRow(userId);
            accrueWalletThroughToday(userId, row, walletCap, now);
            Long balOb = jdbcTemplate.queryForObject(
                    "SELECT balance FROM user_ai_token_wallets WHERE user_id = ?", Long.class, userId);
            long walletBalance = balOb == null ? 0L : balOb;
            long remaining = Math.max(0L, walletBalance);
            return new QuotaSnapshot(
                    row.planCode,
                    false,
                    vn[0], vn[1],
                    dailyGrant,
                    usedToday,
                    walletBalance,
                    walletCap,
                    remaining,
                    row.startsAt(),
                    row.endsAtExclusive()
            );
        }

        if (PLAN_FREE.equals(row.planCode)) {
            long remaining = Math.max(0L, dailyGrant - usedToday);
            return new QuotaSnapshot(
                    PLAN_FREE,
                    false,
                    vn[0], vn[1],
                    dailyGrant,
                    usedToday,
                    0L,
                    0L,
                    remaining,
                    row.startsAt(),
                    row.endsAtExclusive()
            );
        }

        return new QuotaSnapshot(
                row.planCode(),
                false,
                vn[0], vn[1],
                0L,
                usedToday,
                0L,
                0L,
                0L,
                row.startsAt(),
                row.endsAtExclusive()
        );
    }

    private static QuotaSnapshot emptySnapshot(Instant now, String code) {
        Instant[] vn = QuotaVnCalendar.vnDayBoundsInclusiveExclusive(now);
        long usedToday = 0;
        return new QuotaSnapshot(
                code,
                false,
                vn[0], vn[1],
                0L,
                usedToday,
                0L,
                0L,
                0L,
                null,
                null
        );
    }

    private long sumUsageBetween(long userId, Instant startInclusive, Instant endExclusive) {
        Long v = jdbcTemplate.queryForObject(
                """
                        SELECT COALESCE(SUM(total_tokens), 0)
                        FROM ai_token_usage_events
                        WHERE user_id = ?
                          AND created_at >= ?
                          AND created_at < ?
                        """,
                Long.class,
                userId, Timestamp.from(startInclusive), Timestamp.from(endExclusive));
        return v == null ? 0L : v;
    }

    /**
     * Reconcile subscriptions:
     * - FREE: auto-set 7-day expiry, end when expired
     * - PRO/ULTRA: when 30-day period ends AND wallet balance is 0 → end subscription
     *   When 30-day period ends but wallet > 0 → keep ACTIVE (user can drain wallet,
     *   but publicTier() shows DEFAULT label since subscription is past ends_at)
     */
    private void reconcileSubscriptions(long userId, Instant now) {
        // FREE: ensure 7-day expiry is set
        jdbcTemplate.update("""
                        UPDATE user_subscriptions
                        SET ends_at = starts_at + INTERVAL '7 days',
                            updated_at = CURRENT_TIMESTAMP
                        WHERE user_id = ?
                          AND status = 'ACTIVE'
                          AND plan_code = 'FREE'
                          AND ends_at IS NULL
                        """, userId);
        // FREE: end expired trials
        jdbcTemplate.update("""
                        UPDATE user_subscriptions
                        SET status = 'ENDED',
                            ends_at = COALESCE(ends_at, ?),
                            updated_at = CURRENT_TIMESTAMP
                        WHERE user_id = ?
                          AND status = 'ACTIVE'
                          AND plan_code = 'FREE'
                          AND ends_at IS NOT NULL
                          AND ends_at <= ?
                        """,
                Timestamp.from(now), userId, Timestamp.from(now));

        // PRO/ULTRA: when subscription period has ended, check wallet balance
        // If wallet is empty → end subscription and downgrade to DEFAULT
        // If wallet has balance → keep ACTIVE so user can drain remaining tokens
        //   (publicTier() will show DEFAULT label since now > ends_at)
        reconcileExpiredPaidWithWallet(userId, now);

        // Ensure at least one active subscription exists
        Integer active = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_subscriptions WHERE user_id = ? AND status = 'ACTIVE'",
                Integer.class, userId);
        if (active == null || active <= 0) {
            provisionDefaultSubscription(userId, now);
        }
    }

    /**
     * For PRO/ULTRA that are past their 30-day ends_at:
     * - If wallet balance > 0 → keep ACTIVE (grace period, user drains wallet)
     * - If wallet balance <= 0 → end subscription, clean up wallet
     */
    private void reconcileExpiredPaidWithWallet(long userId, Instant now) {
        // Find expired PRO/ULTRA subscriptions that are still ACTIVE
        var expiredPaid = jdbcTemplate.queryForList("""
                        SELECT us.id, us.plan_code, us.source
                        FROM user_subscriptions us
                        WHERE us.user_id = ?
                          AND us.status = 'ACTIVE'
                          AND us.plan_code IN ('PRO', 'ULTRA')
                          AND us.ends_at IS NOT NULL
                          AND us.ends_at <= ?
                        """, userId, Timestamp.from(now));

        if (expiredPaid.isEmpty()) return;

        // Check wallet balance
        Long walletBalance = null;
        try {
            walletBalance = jdbcTemplate.queryForObject(
                    "SELECT balance FROM user_ai_token_wallets WHERE user_id = ?", Long.class, userId);
        } catch (Exception ignored) { /* no wallet row */ }

        // Q3 (quyết định owner 28/08): trial hết hạn thì kết thúc HẲN — ENDED + xoá ví,
        // BẤT KỂ ví còn dư. Grace-drain là quyền lợi của người ĐÃ TRẢ TIỀN (họ mua token,
        // token đó là của họ); token trial là quà dùng thử, không mang sang ngày 8 được,
        // nếu không thì "trial 7 ngày" thực chất dài bằng số ngày họ tiết kiệm được ví.
        var expiredTrials = expiredPaid.stream()
                .filter(r -> SOURCE_TRIAL.equals(r.get("source")))
                .toList();
        if (!expiredTrials.isEmpty()) {
            for (var row : expiredTrials) {
                jdbcTemplate.update(
                        "UPDATE user_subscriptions SET status = 'ENDED', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                        row.get("id"));
            }
            // Xoá KHÔNG điều kiện balance: ví trial hết vòng đời cùng trial.
            jdbcTemplate.update("DELETE FROM user_ai_token_wallets WHERE user_id = ?", userId);
            log.info("[Quota][TRIAL_ENDED] userId={} trial hết hạn — đã kết thúc {} gói và xoá ví",
                    userId, expiredTrials.size());
        }

        var expiredPaidOnly = expiredPaid.stream()
                .filter(r -> !SOURCE_TRIAL.equals(r.get("source")))
                .toList();
        if (expiredPaidOnly.isEmpty()) {
            return;
        }

        if (walletBalance != null && walletBalance > 0) {
            // Grace period: wallet has tokens, keep subscription ACTIVE
            // User can still spend tokens, but publicTier() returns DEFAULT
            return;
        }

        // Wallet empty or doesn't exist → fully end the subscription
        for (var row : expiredPaidOnly) {
            jdbcTemplate.update("""
                            UPDATE user_subscriptions
                            SET status = 'ENDED', updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                            """, row.get("id"));
        }
        // Clean up wallet
        jdbcTemplate.update("DELETE FROM user_ai_token_wallets WHERE user_id = ? AND balance <= 0", userId);
    }

    private void provisionDefaultSubscription(long userId, Instant now) {
        Integer active = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_subscriptions WHERE user_id = ? AND status = 'ACTIVE'",
                Integer.class, userId);
        if (active != null && active > 0) {
            return;
        }
        jdbcTemplate.update("""
                        INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, ends_at, source)
                        VALUES (?, ?, 'ACTIVE', ?, NULL, 'DEFAULT')
                        """,
                userId, PLAN_DEFAULT, Timestamp.from(now));
    }

    /**
     * D-5: phân biệt "không có subscription ACTIVE" (hợp lệ → DEFAULT) với "có subscription ACTIVE nhưng
     * KHÔNG resolve được plan" (plan thiếu / {@code is_active=false}). Trường hợp sau âm thầm hạ một user
     * trả tiền về DEFAULT (0 token); log ERROR để ops xử lý thay vì user mất quyền không dấu vết. Chỉ chạy
     * khi {@link #loadActiveCoveringSubscription} trả null — hiếm trên hot-path (user mới chưa provision, hoặc anomaly).
     */
    private void warnIfUnresolvedActiveSubscription(long userId, Instant now) {
        Map<String, Object> orphan = firstRow(jdbcTemplate, """
                        SELECT us.plan_code AS planCode, sp.code AS planExists, sp.is_active AS planActive
                        FROM user_subscriptions us
                        LEFT JOIN subscription_plans sp ON sp.code = us.plan_code
                        WHERE us.user_id = ?
                          AND us.status = 'ACTIVE'
                          AND us.starts_at <= ?
                          AND (us.ends_at IS NULL OR us.ends_at > ?)
                        ORDER BY us.starts_at DESC, us.id DESC
                        LIMIT 1
                        """, userId, Timestamp.from(now), Timestamp.from(now));
        if (orphan != null) {
            log.error("[Quota][D-5] userId={} có subscription ACTIVE plan_code={} nhưng plan KHÔNG resolve "
                            + "(planExists={}, planActive={}) → bị phục vụ DEFAULT (0 token). "
                            + "Kiểm tra subscription_plans.is_active / seed plan.",
                    userId, orphan.get("planCode"), orphan.get("planExists") != null, orphan.get("planActive"));
        }
    }

    private SubscriptionRow loadActiveCoveringSubscription(long userId, Instant now) {
        Map<String, Object> raw = firstRow(jdbcTemplate, """
                        SELECT us.id AS sid,
                               us.plan_code AS planCode,
                               us.starts_at AS startsAt,
                               us.ends_at AS endsAt,
                               COALESCE(us.monthly_token_limit_override, sp.daily_token_grant) AS dailyGrantRaw,
                               sp.wallet_cap_days AS walletCapDays,
                               us.source AS source
                        FROM user_subscriptions us
                        JOIN subscription_plans sp ON sp.code = us.plan_code
                        WHERE us.user_id = ?
                          AND us.status = 'ACTIVE'
                          AND sp.is_active
                          AND us.starts_at <= ?
                          AND (us.ends_at IS NULL OR us.ends_at > ?)
                        ORDER BY us.starts_at DESC, us.id DESC
                        LIMIT 1
                        """, userId, Timestamp.from(now), Timestamp.from(now));

        if (raw == null) {
            warnIfUnresolvedActiveSubscription(userId, now);
            return null;
        }

        Timestamp startsTs = (Timestamp) raw.get("startsAt");
        Timestamp endsTs = (Timestamp) raw.get("endsAt");
        Instant starts = startsTs == null ? Instant.EPOCH : startsTs.toInstant();
        Instant endsExcl = endsTs == null ? null : endsTs.toInstant();

        return new SubscriptionRow(
                toLong(raw.get("sid")),
                String.valueOf(raw.get("planCode")),
                starts,
                endsExcl,
                toLong(raw.get("dailyGrantRaw")),
                toInt(raw.get("walletCapDays")),
                raw.get("source") == null ? null : String.valueOf(raw.get("source"))
        );
    }

    private void ensureWalletRow(long userId) {
        jdbcTemplate.update("""
                        INSERT INTO user_ai_token_wallets (user_id, balance, last_accrual_local_date)
                        VALUES (?, 0, NULL)
                        ON CONFLICT (user_id) DO NOTHING
                        """, userId);
    }

    private void accrueWalletThroughToday(long userId, SubscriptionRow sub, long walletCap, Instant now) {
        LocalDate today = QuotaVnCalendar.localDateOf(now);
        LocalDate subscriptionStart = QuotaVnCalendar.localDateOf(sub.startsAt);

        var lastRows = jdbcTemplate.query(
                "SELECT last_accrual_local_date FROM user_ai_token_wallets WHERE user_id = ? LIMIT 1",
                (rs, rowNum) -> {
                    Date ddb = rs.getDate(1);
                    return ddb == null ? null : ddb.toLocalDate();
                },
                userId);
        LocalDate lastAccruedTo = lastRows.isEmpty() ? null : lastRows.get(0);

        Long balanceObj = jdbcTemplate.queryForObject(
                "SELECT balance FROM user_ai_token_wallets WHERE user_id = ?", Long.class, userId);
        long balance = balanceObj == null ? 0L : balanceObj;
        long daily = Math.max(0L, sub.dailyGrant);

        LocalDate baseline = subscriptionStart.minusDays(1);
        LocalDate from = baseline;
        if (lastAccruedTo != null) {
            LocalDate normalized = lastAccruedTo.isBefore(subscriptionStart.minusDays(1))
                    ? subscriptionStart.minusDays(1)
                    : lastAccruedTo;
            from = normalized;
        }
        long spanDays = Math.max(0L, ChronoUnit.DAYS.between(from, today));
        if (walletCap <= 0L || daily <= 0L || spanDays <= 0L) {
            jdbcTemplate.update("""
                            UPDATE user_ai_token_wallets
                            SET balance = ?, last_accrual_local_date = ?, updated_at = CURRENT_TIMESTAMP
                            WHERE user_id = ?
                            """,
                    Math.min(balance, walletCap), Date.valueOf(today), userId);
            return;
        }

        long newBalance = computeAccruedWalletBalance(subscriptionStart, lastAccruedTo, walletCap, daily, today, balance);

        jdbcTemplate.update("""
                        UPDATE user_ai_token_wallets
                        SET balance = ?, last_accrual_local_date = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE user_id = ?
                        """,
                newBalance, Date.valueOf(today), userId);
    }

    /**
     * Maps stored plan code to public-facing tier label.
     * DEFAULT/FREE → "DEFAULT", PRO → "PRO", ULTRA/INTERNAL → "ULTRA"
     */
    public static String publicTier(String planCode) {
        if (planCode == null || planCode.isBlank()) {
            return "DEFAULT";
        }
        String c = planCode.trim().toUpperCase(Locale.ROOT);
        return switch (c) {
            case PLAN_FREE, PLAN_DEFAULT -> "DEFAULT";
            case PLAN_PRO -> "PRO";
            case PLAN_ULTRA, PLAN_INTERNAL -> "ULTRA";
            default -> "DEFAULT";
        };
    }

    private static boolean isWalletPlan(String planCode) {
        if (planCode == null) return false;
        String c = planCode.toUpperCase(Locale.ROOT);
        return PLAN_PRO.equals(c) || PLAN_ULTRA.equals(c);
    }

    private static Map<String, Object> firstRow(JdbcTemplate jdbc, String sql, Object... args) {
        var rows = jdbc.queryForList(sql, args);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private static long toLong(Object raw) {
        if (raw instanceof Number n) return n.longValue();
        if (raw == null) return 0L;
        try {
            return Long.parseLong(String.valueOf(raw));
        } catch (Exception e) {
            return 0L;
        }
    }

    private static int toInt(Object raw) {
        if (raw instanceof Number n) return n.intValue();
        if (raw == null) return 0;
        try {
            return Integer.parseInt(String.valueOf(raw));
        } catch (Exception e) {
            return 0;
        }
    }

    private record SubscriptionRow(
            long subscriptionId,
            String planCode,
            Instant startsAt,
            Instant endsAtExclusive,
            long dailyGrant,
            int walletCapDays,
            String source
    ) {
        /** Quyền lợi do provisioner cấp lúc đăng ký, không phải do trả tiền (Q2/Q3). */
        boolean isTrial() {
            return SOURCE_TRIAL.equals(source);
        }
    }
}
