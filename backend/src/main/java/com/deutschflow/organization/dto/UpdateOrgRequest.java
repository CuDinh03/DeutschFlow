package com.deutschflow.organization.dto;

import java.time.Instant;

/**
 * Cập nhật gói/ghế/trạng thái tổ chức (platform-admin).
 *
 * <p>{@code monthlyTokenPool} + {@code poolUnlimited} (M-5): trước đây pool KHÔNG set được qua
 * API (chỉ SQL tay) → đây là cần gạt để admin cấu hình hạn mức / bật unlimited có chủ đích.
 * Chỉ field non-null mới được áp.
 *
 * <p>{@code clearValidUntil} (T-03, 10/09/2026): JSON {@code "validUntil": null} và "không gửi
 * validUntil" đều tới đây là {@code null} — record không phân biệt được "xoá hạn" với "không đụng
 * tới hạn". Cờ riêng này là cách duy nhất để admin đưa trung tâm về VÔ THỜI HẠN qua API
 * (trước đó chỉ SQL tay làm được). Gửi cùng lúc {@code validUntil} và {@code clearValidUntil=true}
 * là mâu thuẫn và bị từ chối 400.
 */
public record UpdateOrgRequest(
        String planCode,
        Integer seatLimit,
        String status,
        Instant validUntil,
        Long monthlyTokenPool,
        Boolean poolUnlimited,
        Boolean clearValidUntil
) {
    /** Backward-compat: call site cũ (chưa có cờ xoá hạn) vẫn dùng được. */
    public UpdateOrgRequest(String planCode, Integer seatLimit, String status, Instant validUntil,
                            Long monthlyTokenPool, Boolean poolUnlimited) {
        this(planCode, seatLimit, status, validUntil, monthlyTokenPool, poolUnlimited, null);
    }
}
