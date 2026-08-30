package com.deutschflow.common.quota;

import java.time.Instant;

/**
 * Public-facing subscription tier for UI (no token usage).
 *
 * @param planCode Stored plan identifier (FREE, PRO, ULTRA, …).
 * @param tier Stable label for localization: BASIC, PREMIUM, or ULTRA.
 * @param startsAtUtc When the active subscription began (UTC instant), or {@code null} if unknown.
 * @param endsAtUtc Scheduled subscription end (exclusive of this instant per DB predicate); {@code null} if open-ended.
 */
/**
 * Quyền lợi hiện tại của một user.
 *
 * <p>{@code isTrial}/{@code trialEndsAt} thêm ở GĐ 2 (onb_v3) và là THUẦN BỔ SUNG —
 * bốn trường cũ giữ nguyên vị trí và ý nghĩa cho client đang chạy.
 *
 * <p>Vì sao client cần biết: quyết định Q1 (28/08) nói trong 7 ngày trial thì
 * paywall/upsell bị ẩn HOÀN TOÀN. Suy ra từ {@code tier == "PRO"} là sai — người đã
 * TRẢ TIỀN cũng là PRO, và họ không được ẩn paywall gia hạn.
 */
public record PlanBadge(
        String planCode,
        String tier,
        Instant startsAtUtc,
        Instant endsAtUtc,
        boolean isTrial,
        Instant trialEndsAt
) {}
