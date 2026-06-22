package com.deutschflow.organization.dto;

/**
 * Tạo tổ chức mới (platform-admin).
 *
 * <p>B2B model §2.1: admin <b>pre-create</b> tài khoản OWNER. {@code ownerName}/{@code ownerPassword}
 * dùng khi {@code ownerEmail} chưa có account → tạo thẳng account OWNER (không còn mời self-register).
 * Nếu email đã tồn tại → chỉ gắn làm OWNER (hai trường owner bị bỏ qua).
 */
public record CreateOrgRequest(
        String name,
        String slug,
        String planCode,
        Integer seatLimit,
        String ownerEmail,
        String ownerName,
        String ownerPassword
) {
    /** Backward-compat: call site cũ (chưa truyền owner name/password) vẫn dùng được. */
    public CreateOrgRequest(String name, String slug, String planCode, Integer seatLimit, String ownerEmail) {
        this(name, slug, planCode, seatLimit, ownerEmail, null, null);
    }
}
