package com.deutschflow.common.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.BAD_REQUEST)
public class BadRequestException extends RuntimeException {

    /** Mã máy-đọc-được cho {@code extensions.code}; {@code null} = 400 thường, không có extensions. */
    private final String code;

    public BadRequestException(String message) {
        this(message, null);
    }

    /**
     * @param code mã cho client chọn thông điệp/hành vi, cùng họ với {@code ORG_READ_ONLY} và
     *             {@code MINOR_AUDIO_BLOCKED} — {@code GlobalExceptionHandler} phát nó ở
     *             {@code extensions.code}. {@code null} giữ nguyên hợp đồng 400 cũ (không extensions)
     */
    public BadRequestException(String message, String code) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
