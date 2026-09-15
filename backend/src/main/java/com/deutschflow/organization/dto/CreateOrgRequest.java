package com.deutschflow.organization.dto;

/**
 * Tạo tổ chức mới (platform-admin).
 *
 * <p>B2B model §2.1: admin <b>pre-create</b> tài khoản OWNER. {@code ownerName}/{@code ownerPassword}
 * dùng khi {@code ownerEmail} chưa có account → tạo thẳng account OWNER (không còn mời self-register).
 * Nếu email đã tồn tại → chỉ gắn làm OWNER (hai trường owner bị bỏ qua).
 *
 * <p>{@code monthlyTokenPool}/{@code poolUnlimited} (T-03, 10/09/2026): trung tâm dựng xong với
 * {@code pool=0, unlimited=false} là nhân sự bị 429 {@code ORG_BUDGET_NOT_CONFIGURED} ngay lần
 * dùng AI đầu tiên (fail-safe của {@code OrgQuotaService}). Cho phép đặt hạn mức NGAY LÚC TẠO để
 * org mới không rơi vào cái bẫy đó; không truyền thì giữ hành vi cũ (chưa cấu hình).
 */
public record CreateOrgRequest(
        String name,
        String slug,
        String planCode,
        Integer seatLimit,
        String ownerEmail,
        String ownerName,
        String ownerPassword,
        Long monthlyTokenPool,
        Boolean poolUnlimited
) {
    /** Backward-compat: call site cũ (chưa truyền owner name/password) vẫn dùng được. */
    public CreateOrgRequest(String name, String slug, String planCode, Integer seatLimit, String ownerEmail) {
        this(name, slug, planCode, seatLimit, ownerEmail, null, null, null, null);
    }

    /** Backward-compat: call site trước T-03 (chưa có hạn mức AI lúc tạo). */
    public CreateOrgRequest(String name, String slug, String planCode, Integer seatLimit, String ownerEmail,
                            String ownerName, String ownerPassword) {
        this(name, slug, planCode, seatLimit, ownerEmail, ownerName, ownerPassword, null, null);
    }
}
