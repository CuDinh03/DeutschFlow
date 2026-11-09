package com.deutschflow.common.security.support;

/**
 * Cờ ThreadLocal "connection DB lấy trên thread này phải READ ONLY" — lưới chặn cuối của phiên hỗ trợ chỉ-đọc
 * ({@link SupportReadOnlyDataSource}).
 *
 * <p>Tách khỏi {@link SupportSessionContextHolder} có chủ ý: ngữ cảnh phiên sống suốt request (để audit ghi đúng
 * actor), còn cờ DB chỉ bật quanh phần xử lý nghiệp vụ trong {@code SupportSessionReadOnlyFilter}. Bước xác minh
 * phiên ở {@code JwtAuthFilter} (đọc) và bước ghi nhật ký request/vết từ chối của chính filter đó (ghi) chạy
 * NGOÀI cờ.
 */
public final class SupportSessionDbGuard {

    private static final ThreadLocal<Boolean> READ_ONLY = new ThreadLocal<>();

    private SupportSessionDbGuard() {
    }

    public static boolean isActive() {
        return Boolean.TRUE.equals(READ_ONLY.get());
    }

    public static void enter() {
        READ_ONLY.set(Boolean.TRUE);
    }

    public static void exit() {
        READ_ONLY.remove();
    }
}
