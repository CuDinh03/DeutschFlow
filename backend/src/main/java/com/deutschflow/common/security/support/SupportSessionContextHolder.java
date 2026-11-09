package com.deutschflow.common.security.support;

/**
 * ThreadLocal mang {@link SupportSessionContext} của request đang chạy trên thread hiện tại.
 *
 * <p>Đặt bởi {@code JwtAuthFilter} ngay khi token {@code typ=support} được xác minh, dọn trong {@code finally}
 * của chính filter đó. Các lớp chặn đọc nó: {@code AuditLogService} (ghi admin làm actor), các client AI và
 * cổng hạn mức (từ chối tiêu token), vài đường "ghi khi đọc" (bỏ qua bước ghi).
 *
 * <p><b>Thread khác:</b> ThreadLocal không theo sang executor. Việc AI bất đồng bộ chỉ được khởi chạy từ
 * endpoint ghi (POST/PUT/PATCH/DELETE), mà phiên hỗ trợ bị chặn mọi method ghi ở
 * {@code SupportSessionReadOnlyFilter} — nên không có job AI nào được sinh ra từ một phiên hỗ trợ.
 */
public final class SupportSessionContextHolder {

    private static final ThreadLocal<SupportSessionContext> CURRENT = new ThreadLocal<>();

    private SupportSessionContextHolder() {
    }

    public static SupportSessionContext current() {
        return CURRENT.get();
    }

    public static boolean isActive() {
        return CURRENT.get() != null;
    }

    public static void set(SupportSessionContext context) {
        if (context == null) {
            CURRENT.remove();
        } else {
            CURRENT.set(context);
        }
    }

    public static void clear() {
        CURRENT.remove();
    }

    /**
     * Ném {@link SupportSessionReadOnlyException} khi thread đang trong phiên hỗ trợ. Gọi ở mọi cửa tiêu token AI
     * (client LLM/STT/embedding, cổng hạn mức, sổ cái usage).
     */
    public static void assertNotSupportSession(String operation) {
        SupportSessionContext ctx = CURRENT.get();
        if (ctx != null) {
            throw new SupportSessionReadOnlyException(
                    "Phiên hỗ trợ chỉ đọc không được dùng AI (" + operation + ").");
        }
    }
}
