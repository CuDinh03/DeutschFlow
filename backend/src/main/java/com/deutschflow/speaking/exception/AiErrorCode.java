package com.deutschflow.speaking.exception;

/**
 * Mã lỗi máy-đọc-được cho các sự cố tầng AI, phát về client qua {@code extensions.code} của
 * ProblemDetail (đường blocking) hoặc payload JSON của SSE event {@code error} (đường stream).
 * Client dùng mã này để chọn thông điệp thân thiện + hành vi retry; KHÔNG dùng làm copy hiển thị.
 * Danh mục theo đặc tả §8.2 của {@code BAO_CAO_AUDIT_SPEAKING_2026-07-24.md}.
 */
public enum AiErrorCode {

    /** Upstream AI lỗi / trả dữ liệu không dùng được sau khi hết ngân sách retry của một lượt gọi. */
    AI_UPSTREAM_UNAVAILABLE,

    /** Nghẽn cục bộ: hết permit concurrency hoặc circuit breaker đang OPEN — nên thử lại sau ít giây. */
    AI_BUSY,

    /** Upstream không phản hồi trong ngân sách thời gian cho phép. */
    AI_TIMEOUT,

    /** Thread bị interrupt trong lúc chờ permit/kết quả — hiếm, thử lại được. */
    AI_INTERRUPTED,

    /** Tính năng AI chưa được cấu hình trên môi trường hiện tại (thiếu env/bean). */
    AI_NOT_CONFIGURED
}
