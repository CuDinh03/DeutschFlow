package com.deutschflow.teacher.dto;

import java.util.List;

/**
 * Yêu cầu so sánh độ chuẩn của nhiều model AI khi chấm Schreiben (admin, harness F1).
 *
 * @param models      danh sách model cần so (null/rỗng ⇒ bộ mặc định). Slug đúng của nhà cung cấp
 *                    đang chạy, vd {@code accounts/fireworks/models/deepseek-v4-flash}
 * @param cases       các bài viết kèm điểm chuẩn (giám khảo) để đối chiếu
 * @param tier        tầng lấy endpoint/knob: {@code GRADING_EXAM} (mặc định) hoặc {@code GRADING_DAILY}
 * @param maxTokens   ngân sách completion mỗi bài; null/≤0 ⇒ ngân sách mặc định của luồng chấm.
 *                    <b>Phải đặt tay khi so model lạ:</b> đo 09/08 cho thấy V4 Flash / Qwen 3.7 Plus /
 *                    Kimi K2.6 tiêu 1000–2900 token trong khi 120b chỉ ~292 ⇒ để ngân sách cũ thì
 *                    phép đo hoá thành "model nào ít bị cắt JSON hơn" (xem F1.0 trong checklist)
 * @param parallelism số bài chấm song song; null ⇒ 2. Bị chặn trần bởi semaphore chat của client
 *                    (mặc định 5 trên prod) và CHIA SẺ nó với traffic thật ⇒ chạy ngoài giờ cao điểm
 */
public record GradingEvalRequest(
        List<String> models,
        List<EvalCase> cases,
        String tier,
        Integer maxTokens,
        Integer parallelism) {

    /** Giữ chữ ký 2 tham số cho call site/test cũ. */
    public GradingEvalRequest(List<String> models, List<EvalCase> cases) {
        this(models, cases, null, null, null);
    }

    /**
     * @param topic          chủ đề (tùy chọn)
     * @param essay          nội dung bài viết tiếng Đức
     * @param referenceScore điểm chuẩn do giám khảo/người chấm (0–100) để đo sai số
     */
    public record EvalCase(String topic, String essay, int referenceScore) {}
}
