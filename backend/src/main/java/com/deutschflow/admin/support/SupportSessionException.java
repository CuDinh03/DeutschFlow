package com.deutschflow.admin.support;

import org.springframework.http.HttpStatus;

/**
 * Lỗi nghiệp vụ của phiên hỗ trợ → problem+json với {@code extensions.code} (GlobalExceptionHandler).
 */
public class SupportSessionException extends RuntimeException {

    /** Đích là ADMIN — không bao giờ được xem như ADMIN khác. */
    public static final String TARGET_FORBIDDEN = "SUPPORT_TARGET_FORBIDDEN";
    /** Đích đang bị khoá. */
    public static final String TARGET_INACTIVE = "SUPPORT_TARGET_INACTIVE";
    /** Tự xem chính mình. */
    public static final String TARGET_SELF = "SUPPORT_TARGET_SELF";
    /** Lý do thiếu/ngắn/dài. */
    public static final String REASON_INVALID = "SUPPORT_REASON_INVALID";
    /** Quá 20 phiên trong 24 giờ. */
    public static final String DAILY_LIMIT = "SUPPORT_DAILY_LIMIT";
    /** Mã bàn giao sai/hết hạn/đã dùng, hoặc cookie phiên admin không khớp. */
    public static final String HANDOFF_INVALID = "SUPPORT_HANDOFF_INVALID";
    /** Kill-switch {@code app.security.support-session.enabled=false}. */
    public static final String DISABLED = "SUPPORT_SESSION_DISABLED";

    private final HttpStatus status;
    private final String code;

    public SupportSessionException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }
}
