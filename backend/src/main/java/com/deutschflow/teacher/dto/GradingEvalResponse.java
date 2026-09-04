package com.deutschflow.teacher.dto;

import java.util.List;

/**
 * Kết quả so sánh độ chuẩn các model chấm Schreiben — xếp theo MAE tăng dần (harness F1).
 *
 * @param results   số liệu từng model
 * @param bestModel model có MAE thấp nhất (khớp giám khảo nhất); null nếu không model nào chấm được
 * @param tier      tầng đã dùng để chấm (endpoint + knob của tầng đó)
 * @param maxTokens ngân sách completion đã dùng mỗi bài — số này PHẢI đọc kèm khi so kết quả, vì
 *                  ngân sách chật làm model dài dòng bị cắt JSON và trông như "chấm kém"
 */
public record GradingEvalResponse(
        List<ModelResult> results,
        String bestModel,
        String tier,
        int maxTokens) {

    /**
     * @param model             tên model
     * @param graded            số bài chấm được (parse ra điểm)
     * @param failed            số bài model không trả về điểm hợp lệ
     * @param mae               sai số tuyệt đối trung bình so với điểm chuẩn (thấp = chuẩn hơn); null nếu graded=0
     * @param meanBias          lệch trung bình có dấu (dương = model chấm CAO hơn giám khảo)
     * @param withinFiveRate    tỉ lệ bài lệch ≤ 5 điểm so với giám khảo (0–1)
     * @param withinTenRate     tỉ lệ bài lệch ≤ 10 điểm — "trong vòng 1 band" theo thang 10 điểm
     * @param feedbackMissing   số bài CÓ điểm nhưng MẤT nhận xét. Đây là chỉ số quan trọng nhất
     *                          ngoài MAE: khi JSON bị cắt, {@code parseScore} vẫn móc được điểm bằng
     *                          regex fallback nên bài trông như chấm xong, chỉ nhận xét/criteria biến
     *                          mất — kiểu hỏng ÂM THẦM của FW.7. Số này &gt; 0 nghĩa là ngân sách
     *                          token quá chật cho model, ĐỪNG đọc MAE của nó như kết quả chất lượng
     * @param maxCompletionTokens token sinh nhiều nhất trong các bài chấm được — dùng để biết ngân
     *                          sách thật cần bao nhiêu nếu flip sang model này
     * @param latencyP50Ms      trung vị thời gian chấm một bài
     * @param latencyP95Ms      p95 — luồng chấm đồng bộ (CORRECT_WRITING, lead-magnet) phải soi số này
     * @param costUsd           tổng chi phí ước tính của model này trong lượt đo (đã trừ giá cached-input)
     * @param costPerCaseVnd    chi phí trung bình mỗi bài, quy đổi VND
     * @param cases             chi tiết từng bài
     */
    public record ModelResult(
            String model,
            int graded,
            int failed,
            Double mae,
            Double meanBias,
            Double withinFiveRate,
            Double withinTenRate,
            int feedbackMissing,
            int maxCompletionTokens,
            Long latencyP50Ms,
            Long latencyP95Ms,
            Double costUsd,
            Long costPerCaseVnd,
            List<CaseScore> cases) {}

    /**
     * @param referenceScore    điểm giám khảo
     * @param aiScore           null nếu model không chấm được bài này
     * @param feedbackMissing   true = có điểm nhưng không có nhận xét (dấu hiệu JSON bị cắt)
     * @param latencyMs         thời gian chấm bài này
     * @param promptTokens      token prompt (đã gồm phần cache)
     * @param cachedTokens      phần prompt phục vụ từ cache của nhà cung cấp
     * @param completionTokens  token sinh ra
     */
    public record CaseScore(
            int referenceScore,
            Integer aiScore,
            boolean feedbackMissing,
            Long latencyMs,
            Integer promptTokens,
            Integer cachedTokens,
            Integer completionTokens) {

        /** Giữ chữ ký 2 tham số cho test/call site cũ chỉ quan tâm điểm. */
        public CaseScore(int referenceScore, Integer aiScore) {
            this(referenceScore, aiScore, false, null, null, null, null);
        }
    }
}
