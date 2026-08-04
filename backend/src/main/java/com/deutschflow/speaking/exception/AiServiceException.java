package com.deutschflow.speaking.exception;

/**
 * Thrown when the upstream AI provider is unavailable, overloaded, or the request could not be
 * completed within its time budget. Mapped to HTTP 503 by the GlobalExceptionHandler.
 *
 * <p>{@link #getCode()} là mã máy-đọc-được để client phân loại (handler đặt vào
 * {@code extensions.code} của ProblemDetail); {@link #getRetryAfterSeconds()} (nullable) gợi ý
 * thời điểm thử lại — handler phát kèm header {@code Retry-After} khi có. Message phải luôn là
 * câu tiếng Việt trung tính, an toàn để hiển thị thẳng cho người dùng: không tên vendor, không
 * mã lỗi upstream, không tiếng Anh kỹ thuật (audit speaking 24/07, R-B9).
 */
public class AiServiceException extends RuntimeException {

    private final AiErrorCode code;
    private final Integer retryAfterSeconds;

    public AiServiceException(String message) {
        this(AiErrorCode.AI_UPSTREAM_UNAVAILABLE, message, (Integer) null);
    }

    public AiServiceException(String message, Throwable cause) {
        this(AiErrorCode.AI_UPSTREAM_UNAVAILABLE, message, null, cause);
    }

    public AiServiceException(AiErrorCode code, String message, Integer retryAfterSeconds) {
        super(message);
        this.code = code;
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public AiServiceException(AiErrorCode code, String message, Integer retryAfterSeconds, Throwable cause) {
        super(message, cause);
        this.code = code;
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public AiErrorCode getCode() {
        return code;
    }

    /**
     * Predicate cho {@code CircuitBreakers.call(..)}: lỗi HẠN MỨC (429) không phải "upstream chết"
     * — bucket refill trong ~1 phút, nên không được đếm vào tỉ lệ failure của breaker (PR #291,
     * chuỗi sập 04/08: 2×429 mở breaker ⇒ mọi user 503). Dùng chung cho chat lẫn Whisper.
     */
    public static boolean isRateLimited(Throwable t) {
        return t instanceof AiServiceException ase && ase.getCode() == AiErrorCode.RATE_LIMITED;
    }

    /** Nullable — chỉ có ở lỗi kiểu "bận/quá tải" nơi biết được thời điểm nên thử lại. */
    public Integer getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
