package com.deutschflow.organization.dto;

/**
 * Xem trước lời mời (public, token là secret).
 *
 * <p>KHÔNG bao giờ tiết lộ email này đã có tài khoản hay chưa (từng có field
 * {@code requiresRegistration}). Với caller ẩn danh, đó là "account-existence oracle" —
 * kẻ giữ token biết chắc email nào có tài khoản để nhắm chiếm quyền. Việc account đã tồn tại
 * hay chưa chỉ được xử lý ở {@code accept()} sau khi người dùng chứng minh quyền sở hữu.
 */
public record InvitationPreviewDto(
        String orgName,
        String role,
        String email,
        boolean expired
) {}
