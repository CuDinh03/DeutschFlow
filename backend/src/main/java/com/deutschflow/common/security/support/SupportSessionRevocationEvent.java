package com.deutschflow.common.security.support;

/**
 * Yêu cầu đóng các phiên hỗ trợ đang mở — phát ĐỒNG BỘ (trong transaction của người phát) từ những chỗ làm một
 * phiên hỗ trợ mất căn cứ: admin đăng xuất, admin bị hạ quyền/khoá, admin bị đặt lại 2FA, người dùng đích bị
 * khoá hoặc được nâng lên ADMIN. Bên nghe: {@code SupportSessionService}.
 *
 * <p>Đây là đường "đóng sạch" (có vết {@code support_session.ended}). Kể cả khi sự kiện bị bỏ lỡ,
 * {@code SupportSessionVerifier} vẫn kiểm sống từng request (admin còn ADMIN hoạt động, đích còn hợp lệ) với
 * cache tối đa 10 s.
 *
 * @param adminUserId  đóng mọi phiên do admin này mở ({@code null} = không lọc theo admin)
 * @param targetUserId đóng mọi phiên đang xem người dùng này ({@code null} = không lọc theo đích)
 * @param endReason    giá trị {@code admin_support_sessions.end_reason} (≤ 32 ký tự)
 */
public record SupportSessionRevocationEvent(Long adminUserId, Long targetUserId, String endReason) {

    public static SupportSessionRevocationEvent forAdmin(long adminUserId, String endReason) {
        return new SupportSessionRevocationEvent(adminUserId, null, endReason);
    }

    public static SupportSessionRevocationEvent forTarget(long targetUserId, String endReason) {
        return new SupportSessionRevocationEvent(null, targetUserId, endReason);
    }
}
