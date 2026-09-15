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
 *
 * <p>{@code source} thêm ở V-06 và cũng là THUẦN BỔ SUNG (thêm ở CUỐI record).
 *
 * @param source AI trả tiền cho quyền lợi này, đã chuẩn hoá cho client:
 *               {@code ORG} (trung tâm cấp) | {@code APPLE} (mua trong app) | {@code WEB}
 *               (mọi ngả còn lại: trial, DEFAULT, SePay/Stripe/MoMo…). Client PHẢI ẩn
 *               "huỷ gói"/"hoàn tiền" khi {@code ORG} — gói ấy do trung tâm trả tiền,
 *               học viên không có gì để huỷ ở Apple.
 */
public record PlanBadge(
        String planCode,
        String tier,
        Instant startsAtUtc,
        Instant endsAtUtc,
        boolean isTrial,
        Instant trialEndsAt,
        String source
) {}
