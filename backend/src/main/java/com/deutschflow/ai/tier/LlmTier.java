package com.deutschflow.ai.tier;

import java.util.Locale;

/**
 * Tầng LLM của toàn hệ thống — mỗi chức năng gọi AI khai "tôi thuộc tầng nào" thay vì tự chọn
 * model (kế hoạch {@code plans/2026-08-07-ke-hoach-khung-ai-tier.md}, khu vực A).
 *
 * <p>Model/endpoint/tham số của từng tầng nằm trong {@code app.ai.llm.tiers.*} (application.yml,
 * env-overridable) — đổi model là đổi config, KHÔNG sửa code. Trước khung này, call site truyền
 * {@code model=null} rơi ngầm về model NÓI, gây ra 4 luồng chấm bài chạy nhầm model tốc độ.
 */
public enum LlmTier {

    /** Chat nói real-time gói FREE (SSE, JSON mode, latency là vua). */
    CHAT_FREE,
    /** Chat nói real-time gói trả phí (P4 mới trỏ Cerebras; P1–P3 = CHAT_FREE). */
    CHAT_PAID,
    /** Thẩm định errors/suggestions của lượt chat trước khi persist (P4, khu vực C). */
    ERROR_VERIFY,
    /** Chấm có tính phán quyết: mock exam, grammar exam, Sprechen Teil 2, placement, essay B2B. */
    GRADING_EXAM,
    /** Chấm feedback thường nhật: cuối phiên hội thoại, cuối phỏng vấn. */
    GRADING_DAILY,
    /** Giải thích lỗi/sửa câu cho học viên (AiTextService). */
    EXPLAIN,
    /** Sinh nội dung bài học có cache (SkillTree/PracticeNode) — học viên ĐANG CHỜ kết quả. */
    CONTENT,
    /**
     * Sinh nội dung bài học TRƯỚC theo lô, khi chưa có học viên nào chờ (admin batch).
     *
     * <p>Tách khỏi {@link #CONTENT} theo quyết định #15 (09/08): model mạnh cho nội dung sư phạm
     * là đáng tiền vì sinh MỘT lần rồi cache phục vụ nghìn lượt — nhưng đo thật thấy Kimi K2.6
     * mất <b>32–41s mỗi node</b>, không ai chờ nổi ở đường unlock. Dùng chung một tier thì buộc
     * phải chọn một trong hai; tách ra thì đường lô mua được chất lượng mà đường realtime vẫn nhanh.
     */
    CONTENT_BATCH,
    /** Việc batch chạy đêm, không nhạy latency (tag từ vựng, …). */
    BATCH;

    /** Khoá cấu hình trong {@code app.ai.llm.tiers} — dạng kebab-case: {@code grading-exam}. */
    public String configKey() {
        return name().toLowerCase(Locale.ROOT).replace('_', '-');
    }
}
