package com.deutschflow.common.quota;

import java.time.Instant;

/** Token budget for learner AI — VN calendar day (+ optional rollover wallet). */
public record QuotaSnapshot(
        String planCode,
        boolean unlimitedInternal,
        Instant vnPeriodStartInclusive,
        Instant vnPeriodEndExclusive,
        long dailyTokenGrant,
        /** Sum of {@code ai_token_usage_events.total_tokens} in the VN day window below. */
        long usedToday,
        long walletBalance,
        /** Max wallet size ({@code walletCapDays * dailyGrant}) for rollover tiers; 0 for FREE/DEFAULT/INTERNAL bypass. */
        long walletCap,
        long remainingSpendable,
        /** Active {@code user_subscriptions.starts_at}; null when unknown. */
        Instant subscriptionStartsAtUtc,
        /**
         * Active {@code user_subscriptions.ends_at}. Active while {@code now < ends_at} (exclusive).
         * {@code null} means no scheduled end (open-ended).
         */
        Instant subscriptionEndsAtUtc
) {
    /** Alias for dashboards that still speak “monthly”. */
    public long monthlyTokenLimit() {
        if (unlimitedInternal) {
            return 999_999_999L;
        }
        return walletCap > 0 ? walletCap : dailyTokenGrant;
    }

    /** Alias mapped to ledger usage in current VN day. */
    public long usedThisMonth() {
        return usedToday;
    }

    /** Remaining tokens usable for AI in the current quota model. */
    public long remainingThisMonth() {
        if (unlimitedInternal) {
            return 999_999_999L;
        }
        return remainingSpendable;
    }

    /** Start of quota window used for counting {@link #usedToday} (VN midnight UTC instant). */
    public Instant periodStartUtc() {
        return vnPeriodStartInclusive;
    }

    /** End of quota window exclusive (next VN midnight UTC instant). */
    public Instant periodEndUtc() {
        return vnPeriodEndExclusive;
    }
}
