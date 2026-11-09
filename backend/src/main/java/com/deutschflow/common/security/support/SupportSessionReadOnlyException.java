package com.deutschflow.common.security.support;

/**
 * Thao tác bị cấm trong phiên hỗ trợ chỉ-đọc → 403 problem+json {@code extensions.code=SUPPORT_SESSION_READ_ONLY}
 * (GlobalExceptionHandler; {@code SupportSessionReadOnlyFilter} tự ghi body cùng khuôn).
 */
public class SupportSessionReadOnlyException extends RuntimeException {

    public static final String CODE = "SUPPORT_SESSION_READ_ONLY";

    public SupportSessionReadOnlyException(String message) {
        super(message);
    }
}
