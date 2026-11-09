package com.deutschflow.common.security.support;

/**
 * Danh tính của một request chạy trong phiên hỗ trợ chỉ-đọc: ADMIN {@code adminUserId} đang xem tài khoản
 * {@code targetUserId} qua phiên {@code sessionId}.
 *
 * <p>Principal của request vẫn là entity {@code User} của người dùng đích (để mọi controller trả đúng dữ liệu
 * của họ). Ngữ cảnh này KHÔNG BAO GIỜ được gắn lên entity đó — entity nằm trong cache Caffeine dùng chung giữa
 * các thread của {@code JwtAuthFilter}; nó chỉ sống ở request attribute {@link #REQUEST_ATTRIBUTE} và ở
 * {@link SupportSessionContextHolder} (ThreadLocal, dọn trong {@code finally}).
 */
public record SupportSessionContext(long sessionId, long adminUserId, String adminEmail, long targetUserId) {

    /** Tên request attribute mang ngữ cảnh (đặt bởi {@code JwtAuthFilter}). */
    public static final String REQUEST_ATTRIBUTE = SupportSessionContext.class.getName();
}
