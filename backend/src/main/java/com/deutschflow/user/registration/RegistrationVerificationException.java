package com.deutschflow.user.registration;

import org.springframework.http.HttpStatus;

/**
 * Lỗi của luồng mã PIN đăng ký. {@code reason} là mã máy cho client chọn câu (luật "giao diện không
 * hiện mã máy"); {@code GlobalExceptionHandler} phát nó ở {@code extensions.code} + {@code extensions.reason},
 * kèm {@code extensions.remainingAttempts} khi có.
 */
public class RegistrationVerificationException extends RuntimeException {

    public enum Reason {
        /** Mã sai, email lạ, hoặc email đã có tài khoản — cố ý cùng một mã để không lộ email nào tồn tại. */
        INVALID_CODE(HttpStatus.BAD_REQUEST),
        LOCKED(HttpStatus.BAD_REQUEST),
        EXPIRED(HttpStatus.BAD_REQUEST),
        /** Email/SĐT bị chiếm giữa start và verify (đường /register cũ, ADMIN tạo tay). */
        ACCOUNT_EXISTS(HttpStatus.CONFLICT),
        SEND_FAILED(HttpStatus.SERVICE_UNAVAILABLE),
        /** Công tắc tắt ⇒ client rơi về /register cũ. */
        DISABLED(HttpStatus.NOT_IMPLEMENTED),
        /** /register cũ đã tắt ⇒ client cũ cần cập nhật. */
        LEGACY_REGISTER_DISABLED(HttpStatus.GONE),
        /** Honeypot hoặc Turnstile không qua — cố ý không nói lớp nào (RegistrationAbuseGuard). */
        HUMAN_CHECK_FAILED(HttpStatus.BAD_REQUEST),
        /** Email của dịch vụ hộp thư tạm. */
        DISPOSABLE_EMAIL(HttpStatus.BAD_REQUEST);

        private final HttpStatus status;
        Reason(HttpStatus status) { this.status = status; }
        public HttpStatus status() { return status; }
    }

    private final Reason reason;
    private final Integer remainingAttempts;

    public RegistrationVerificationException(Reason reason, String message) {
        this(reason, message, null);
    }

    public RegistrationVerificationException(Reason reason, String message, Integer remainingAttempts) {
        super(message);
        this.reason = reason;
        this.remainingAttempts = remainingAttempts;
    }

    public Reason getReason() { return reason; }
    public Integer getRemainingAttempts() { return remainingAttempts; }
}
