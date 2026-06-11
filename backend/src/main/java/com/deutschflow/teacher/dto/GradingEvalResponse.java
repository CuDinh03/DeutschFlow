package com.deutschflow.teacher.dto;

import java.util.List;

/**
 * Kết quả so sánh độ chuẩn các model chấm Schreiben — xếp theo MAE tăng dần.
 *
 * @param results   số liệu từng model
 * @param bestModel model có MAE thấp nhất (khớp giám khảo nhất); null nếu không model nào chấm được
 */
public record GradingEvalResponse(List<ModelResult> results, String bestModel) {

    /**
     * @param model         tên model
     * @param graded        số bài chấm được (parse ra điểm)
     * @param failed        số bài model không trả về điểm hợp lệ
     * @param mae           sai số tuyệt đối trung bình so với điểm chuẩn (thấp = chuẩn hơn); null nếu graded=0
     * @param meanBias      lệch trung bình có dấu (dương = model chấm CAO hơn giám khảo)
     * @param withinFiveRate tỉ lệ bài lệch ≤ 5 điểm so với giám khảo (0–1)
     * @param cases         điểm từng bài (đối chiếu reference vs ai)
     */
    public record ModelResult(
            String model,
            int graded,
            int failed,
            Double mae,
            Double meanBias,
            Double withinFiveRate,
            List<CaseScore> cases) {}

    /** @param aiScore null nếu model không chấm được bài này. */
    public record CaseScore(int referenceScore, Integer aiScore) {}
}
