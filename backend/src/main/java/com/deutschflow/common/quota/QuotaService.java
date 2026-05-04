package com.deutschflow.common.quota;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.Map;
import java.util.List;

@Service
@RequiredArgsConstructor
public class QuotaService {

    private static final String PLAN_DEFAULT = "DEFAULT";
    private static final String PLAN_FREE = "FREE";
    private static final String PLAN_INTERNAL = "INTERNAL";

    private final JdbcTemplate jdbcTemplate;

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

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public QuotaSnapshot assertAllowed(long userId, Instant nowUtc, long estimatedMinTokens) {
        QuotaSnapshot snap = buildSnapshot(userId, nowUtc);
        if (snap.unlimitedInternal()) {
            return snap;
        }
        if (snap.remainingSpendable() <= 0L) {
            throw new QuotaExceededException("AI token quota exceeded.", snap);
        }
        if (estimatedMinTokens > 0L && snap.remainingSpendable() < estimatedMinTokens) {
            throw new QuotaExceededException("Not enough AI token quota remaining for this request.", snap);
        }
        return snap;
    }

    @Transactional
    public PlanBadge resolvePlanBadge(long userId, Instant nowUtc) {
        reconcileSubscriptions(userId, nowUtc);
        SubscriptionRow row = loadActiveCoveringSubscription(userId, nowUtc);
        if (row == null) {
            return new PlanBadge(PLAN_DEFAULT, publicTier(PLAN_DEFAULT), null, null);
        }
        return new PlanBadge(
                row.planCode(), publicTier(row.planCode()), row.startsAt(), row.endsAtExclusive());
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
            downgradePaidPlansToDefault(userId, now);
            jdbcTemplate.update("DELETE FROM user_ai_token_wallets WHERE user_id = ?", userId);
        }
    }

    private QuotaSnapshot buildSnapshotReadOnly(long userId, Instant now) {
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
            LocalDate lastAccruedTo = loadWalletLastAccrualLocalDate(userId);
            long currentBalance = loadWalletBalanceOrZero(userId);
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

    /** Fix FREE trials, end expired ACTIVE FREE, ensure DEFAULT exists when orphaned. */
    private void reconcileSubscriptions(long userId, Instant now) {
        jdbcTemplate.update("""
                        UPDATE user_subscriptions
                        SET ends_at = starts_at + INTERVAL '7 days',
                            updated_at = CURRENT_TIMESTAMP
                        WHERE user_id = ?
                          AND status = 'ACTIVE'
                          AND plan_code = 'FREE'
                          AND ends_at IS NULL
                        """, userId);
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

        Integer active = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_subscriptions WHERE user_id = ? AND status = 'ACTIVE'",
                Integer.class, userId);
        if (active == null || active <= 0) {
            provisionDefaultSubscription(userId, now);
        }
    }

    private void downgradePaidPlansToDefault(long userId, Instant now) {
        endSubscriptionsPaid(userId, now);
        provisionDefaultSubscription(userId, now);
    }

    private void endSubscriptionsPaid(long userId, Instant now) {
        jdbcTemplate.update("""
                        UPDATE user_subscriptions
                        SET status = 'ENDED', ends_at = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE user_id = ?
                          AND status = 'ACTIVE'
                          AND plan_code IN ('PRO', 'PREMIUM', 'ULTRA')
                        """,
                Timestamp.from(now), userId);
    }

    private void provisionDefaultSubscription(long userId, Instant now) {
        Integer active = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_subscriptions WHERE user_id = ? AND status = 'ACTIVE'",
                Integer.class, userId);
        if (active != null && active > 0) {
            return;
        }
        jdbcTemplate.update("""
                        INSERT INTO user_subscriptions (user_id, plan_code, status, starts_at, ends_at)
                        VALUES (?, ?, 'ACTIVE', ?, NULL)
                        """,
                userId, PLAN_DEFAULT, Timestamp.from(now));
    }

    private SubscriptionRow loadActiveCoveringSubscription(long userId, Instant now) {
        Map<String, Object> raw = firstRow(jdbcTemplate, """
                        SELECT us.id AS sid,
                               us.plan_code AS planCode,
                               us.starts_at AS startsAt,
                               us.ends_at AS endsAt,
                               COALESCE(us.monthly_token_limit_override, sp.daily_token_grant) AS dailyGrantRaw,
                               sp.wallet_cap_days AS walletCapDays
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
                toInt(raw.get("walletCapDays"))
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

    /** Maps stored {@code subscription_plans.code} to BASIC | PREMIUM | ULTRA for localized labels. */
    public static String publicTier(String planCode) {
        if (planCode == null || planCode.isBlank()) {
            return "BASIC";
        }
        String c = planCode.trim().toUpperCase(Locale.ROOT);
        return switch (c) {
            case PLAN_FREE, PLAN_DEFAULT -> "BASIC";
            case "PRO", "PREMIUM" -> "PREMIUM";
            case "ULTRA", PLAN_INTERNAL -> "ULTRA";
            default -> "BASIC";
        };
    }

    private static boolean isWalletPlan(String planCode) {
        if (planCode == null) return false;
        String c = planCode.toUpperCase(Locale.ROOT);
        return "PRO".equals(c) || "PREMIUM".equals(c) || "ULTRA".equals(c);
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
            int walletCapDays
    ) {}
}
