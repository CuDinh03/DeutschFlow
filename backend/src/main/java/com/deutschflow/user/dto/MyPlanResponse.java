package com.deutschflow.user.dto;

import java.time.Instant;

/**
 * User subscription plan response.
 * Contains plan details visible to the client via /api/auth/me/plan endpoint.
 *
 * @param planCode Stored plan identifier (FREE, PRO, ULTRA, …).
 * @param tier Stable label for localization: BASIC, PREMIUM, or ULTRA.
 * @param startsAtUtc When the active subscription began (UTC instant), or null if unknown.
 * @param endsAtUtc Scheduled subscription end (exclusive); null if open-ended.
 * @param isTrial true khi quyền lợi này là trial 7 ngày do provisioner cấp lúc đăng ký,
 *                KHÔNG phải do trả tiền. Client ẩn toàn bộ paywall/upsell khi cờ này bật
 *                (quyết định Q1, 28/08) — đừng suy ra từ tier, vì người đã trả tiền cũng PRO.
 * @param trialEndsAt Thời điểm trial kết thúc; null khi không phải trial.
 * @param source AI trả tiền cho gói này: {@code ORG} (trung tâm cấp) | {@code APPLE} (mua trong
 *               app) | {@code WEB} (mọi ngả còn lại). V-06: khi {@code ORG}, client PHẢI ẩn
 *               "Quản lý & huỷ gói" và "Yêu cầu hoàn tiền" — học viên không mua gì ở Apple nên
 *               không có gì để huỷ/hoàn, mời họ làm thế là mời họ vào ngõ cụt.
 * @param orgName Tên trung tâm cấp gói; chỉ có nghĩa khi {@code source = ORG}, ngoài ra null.
 */
public record MyPlanResponse(
    String planCode,
    String tier,
    Instant startsAtUtc,
    Instant endsAtUtc,
    boolean isTrial,
    Instant trialEndsAt,
    String source,
    String orgName
) {}
