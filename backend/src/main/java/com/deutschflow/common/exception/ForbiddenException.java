package com.deutschflow.common.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.FORBIDDEN)
public class ForbiddenException extends RuntimeException {

    /** Mã máy-đọc-được cho {@code extensions.code}; {@code null} = 403 thường, không có extensions. */
    private final String code;

    public ForbiddenException(String message) {
        this(message, null);
    }

    /**
     * @param code mã ổn định cho client (cùng họ {@code ORG_READ_ONLY}), phát ở
     *             {@code extensions.code}. {@code null} giữ nguyên hợp đồng 403 cũ.
     */
    public ForbiddenException(String message, String code) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
