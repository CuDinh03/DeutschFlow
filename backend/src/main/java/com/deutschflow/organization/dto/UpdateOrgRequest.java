package com.deutschflow.organization.dto;

import java.time.Instant;

/**
 * Cập nhật gói/ghế/trạng thái tổ chức (platform-admin).
 *
 * <p>{@code monthlyTokenPool} + {@code poolUnlimited} (M-5): trước đây pool KHÔNG set được qua
 * API (chỉ SQL tay) → đây là cần gạt để admin cấu hình hạn mức / bật unlimited có chủ đích.
 * Chỉ field non-null mới được áp.
 */
public record UpdateOrgRequest(
        String planCode,
        Integer seatLimit,
        String status,
        Instant validUntil,
        Long monthlyTokenPool,
        Boolean poolUnlimited
) {}
