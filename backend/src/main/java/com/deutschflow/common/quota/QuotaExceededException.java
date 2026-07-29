package com.deutschflow.common.quota;

import com.deutschflow.speaking.exception.AiErrorCode;

/**
 * 429 của tầng quota AI. Từ thiết kế 2 kênh token (26/07) exception mang theo {@link AiErrorCode}
 * để client phân nhánh đúng ngữ nghĩa:
 * <ul>
 *   <li>{@link AiErrorCode#QUOTA_EXCEEDED} — ví cá nhân (học viên/B2C) cạn → client mời nâng cấp;</li>
 *   <li>{@link AiErrorCode#ORG_BUDGET_EXHAUSTED} / {@link AiErrorCode#ORG_BUDGET_NOT_CONFIGURED}
 *       — pool trung tâm (staff org) → "liên hệ quản trị trung tâm", KHÔNG có CTA nâng cấp (P0-02).</li>
 * </ul>
 * Message của 2 mã org cố ý TRÁNH các chữ "token/hạn mức/quota/dùng thử": bản mobile cũ chưa biết
 * mã mới sẽ fallback regex trên {@code detail} để quyết định upsell — tránh chữ là tránh app cũ
 * mời nâng cấp nhầm người.
 */
public class QuotaExceededException extends RuntimeException {
    private final QuotaSnapshot snapshot;
    private final AiErrorCode code;

    public QuotaExceededException(String message, QuotaSnapshot snapshot) {
        this(message, snapshot, AiErrorCode.QUOTA_EXCEEDED);
    }

    public QuotaExceededException(String message, QuotaSnapshot snapshot, AiErrorCode code) {
        super(message);
        this.snapshot = snapshot;
        this.code = code != null ? code : AiErrorCode.QUOTA_EXCEEDED;
    }

    /** Pool trung tâm đã cạn trong tháng — dùng chung cho gate assertAllowed và OrgPoolGuard. */
    public static QuotaExceededException orgBudgetExhausted(QuotaSnapshot snapshot) {
        return new QuotaExceededException(
                "Ngân sách AI của trung tâm đã hết cho tháng này. Vui lòng liên hệ quản trị trung tâm.",
                snapshot, AiErrorCode.ORG_BUDGET_EXHAUSTED);
    }

    /** Pool trung tâm chưa cấu hình ({@code pool=0 & !unlimited}) — fail-safe V237/P-14. */
    public static QuotaExceededException orgBudgetNotConfigured(QuotaSnapshot snapshot) {
        return new QuotaExceededException(
                "Trung tâm chưa được cấp ngân sách AI. Vui lòng liên hệ quản trị trung tâm.",
                snapshot, AiErrorCode.ORG_BUDGET_NOT_CONFIGURED);
    }

    public QuotaSnapshot getSnapshot() {
        return snapshot;
    }

    public AiErrorCode getCode() {
        return code;
    }
}
