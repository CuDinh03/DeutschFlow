package com.deutschflow.user.mfa;

import org.springframework.http.HttpStatus;

/**
 * Lỗi của luồng 2FA, mang HTTP status + mã máy-đọc-được. {@code GlobalExceptionHandler} phát mã ở
 * {@code extensions.code} (cùng khuôn {@code RESET_CODE_INVALID}, {@code ORG_READ_ONLY}); web chọn câu
 * hiển thị theo mã, không theo {@code detail}.
 *
 * <p>Danh mục mã (giữ đồng bộ với {@code frontend/src/lib/mfaApi.ts}):
 * <ul>
 *   <li>{@value #MFA_REQUIRED} (401) — access token/refresh của ADMIN chưa qua 2FA hoặc phiên 2FA đã quá hạn;</li>
 *   <li>{@value #MFA_REQUIRED_USE_LOGIN} (403) — đường cấp phiên không có bước 2FA (nhận lời mời trung tâm) gặp ADMIN;</li>
 *   <li>{@value #MFA_NOT_CONFIGURED} (503) — máy chủ thiếu {@code MFA_ENCRYPTION_KEY};</li>
 *   <li>{@value #MFA_TOKEN_INVALID} (400) — token thử thách sai/hết hạn/đã dùng → đăng nhập lại từ đầu;</li>
 *   <li>{@value #MFA_CODE_INVALID} (400) — mã email/TOTP/khôi phục sai (một câu cho mọi trường hợp);</li>
 *   <li>{@value #MFA_ALREADY_ENABLED} (409), {@value #MFA_NOT_ENROLLED} (409), {@value #MFA_ENROLLMENT_NOT_STARTED} (409);</li>
 *   <li>{@value #MFA_EMAIL_UNAVAILABLE} (503) — máy chủ không gửi được thư mã;</li>
 *   <li>{@value #MFA_RESET_SELF_FORBIDDEN} (403) — admin tự đặt lại 2FA của chính mình.</li>
 * </ul>
 * Quá số lần sai không dùng mã riêng: đó là 429 {@code RATE_LIMITED} chung ({@code RateLimitExceededException}).
 */
public class MfaException extends RuntimeException {

    public static final String MFA_REQUIRED = "MFA_REQUIRED";
    public static final String MFA_REQUIRED_USE_LOGIN = "MFA_REQUIRED_USE_LOGIN";
    public static final String MFA_NOT_CONFIGURED = "MFA_NOT_CONFIGURED";
    public static final String MFA_TOKEN_INVALID = "MFA_TOKEN_INVALID";
    public static final String MFA_CODE_INVALID = "MFA_CODE_INVALID";
    public static final String MFA_ALREADY_ENABLED = "MFA_ALREADY_ENABLED";
    public static final String MFA_NOT_ENROLLED = "MFA_NOT_ENROLLED";
    public static final String MFA_ENROLLMENT_NOT_STARTED = "MFA_ENROLLMENT_NOT_STARTED";
    public static final String MFA_EMAIL_UNAVAILABLE = "MFA_EMAIL_UNAVAILABLE";
    public static final String MFA_RESET_SELF_FORBIDDEN = "MFA_RESET_SELF_FORBIDDEN";

    private final HttpStatus status;
    private final String code;

    public MfaException(HttpStatus status, String code, String message) {
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

    public static MfaException required() {
        return new MfaException(HttpStatus.UNAUTHORIZED, MFA_REQUIRED,
                "Phiên quản trị cần xác thực hai lớp. Vui lòng đăng nhập lại.");
    }

    public static MfaException notConfigured() {
        return new MfaException(HttpStatus.SERVICE_UNAVAILABLE, MFA_NOT_CONFIGURED,
                "Máy chủ chưa cấu hình xác thực hai lớp (MFA_ENCRYPTION_KEY). Liên hệ người vận hành.");
    }

    public static MfaException tokenInvalid() {
        return new MfaException(HttpStatus.BAD_REQUEST, MFA_TOKEN_INVALID,
                "Phiên xác thực hai lớp đã hết hạn. Vui lòng đăng nhập lại.");
    }

    public static MfaException codeInvalid() {
        return new MfaException(HttpStatus.BAD_REQUEST, MFA_CODE_INVALID,
                "Mã không đúng hoặc đã hết hạn.");
    }
}
