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
    AI_NOT_CONFIGURED,

    /** Nhận diện giọng nói không ra chữ (im lặng, nhiễu, định dạng lạ) — user nói lại hoặc gõ tay. */
    STT_FAILED,

    /** Hết hạn mức token AI của VÍ CÁ NHÂN (kênh học viên/B2C) — client mời nâng cấp, KHÔNG phải lỗi hệ thống. */
    QUOTA_EXCEEDED,

    /**
     * Pool AI của trung tâm ĐÃ CẠN tháng này (kênh staff org — 2 kênh token 26/07).
     * Client hiển thị "liên hệ quản trị trung tâm", KHÔNG mời nâng cấp gói cá nhân (P0-02).
     */
    ORG_BUDGET_EXHAUSTED,

    /**
     * Trung tâm CHƯA được cấp ngân sách AI ({@code pool=0 & !unlimited} — fail-safe V237/P-14).
     * Tách khỏi {@link #ORG_BUDGET_EXHAUSTED} để hết cảnh "chưa cấu hình" đội lốt "đã dùng hết"
     * (bài học org 6/ATB + org 7). Client cũng KHÔNG mời nâng cấp cá nhân.
     */
    ORG_BUDGET_NOT_CONFIGURED,

    /** Vượt giới hạn tần suất tạm thời — client đợi rồi thử lại (kèm Retry-After). */
    RATE_LIMITED
}
