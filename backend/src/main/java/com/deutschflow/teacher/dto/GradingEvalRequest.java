package com.deutschflow.teacher.dto;

import java.util.List;

/**
 * Yêu cầu so sánh độ chuẩn của nhiều model AI khi chấm Schreiben (admin).
 *
 * @param models danh sách model Groq cần so (null/rỗng ⇒ dùng bộ mặc định)
 * @param cases  các bài viết kèm điểm chuẩn (giám khảo) để đối chiếu
 */
public record GradingEvalRequest(List<String> models, List<EvalCase> cases) {

    /**
     * @param topic          chủ đề (tùy chọn)
     * @param essay          nội dung bài viết tiếng Đức
     * @param referenceScore điểm chuẩn do giám khảo/người chấm (0–100) để đo sai số
     */
    public record EvalCase(String topic, String essay, int referenceScore) {}
}
