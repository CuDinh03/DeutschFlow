package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.teacher.dto.GradingEvalRequest;
import com.deutschflow.teacher.dto.GradingEvalResponse;
import com.deutschflow.teacher.dto.GradingEvalResponse.CaseScore;
import com.deutschflow.teacher.dto.GradingEvalResponse.ModelResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Đo độ CHUẨN của các model AI khi chấm Schreiben so với điểm chuẩn của giám khảo (admin).
 *
 * <p>"Chuẩn nhất" là câu hỏi thực nghiệm: harness chấm cùng một bộ bài (kèm điểm người chấm) bằng
 * từng model rồi đo sai số tuyệt đối trung bình (MAE), lệch có dấu, và tỉ lệ lệch ≤5 điểm — xếp hạng
 * theo MAE. Tái dùng đúng lõi {@link GradingService#gradeGermanEssay(String, String, String)} nên
 * prompt/JSON-mode giống hệt sản phẩm thật.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GradingEvalService {

    private static final int MAX_MODELS = 6;
    private static final int MAX_CASES = 50;
    private static final int WITHIN_THRESHOLD = 5;

    /** Bộ model mặc định khi request không chỉ định — ứng viên free chính cho chấm tiếng Đức. */
    static final List<String> DEFAULT_MODELS = List.of(
            "llama-3.3-70b-versatile",
            "meta-llama/llama-4-scout-17b-16e-instruct",
            "openai/gpt-oss-120b");

    private final GradingService gradingService;

    public GradingEvalResponse run(GradingEvalRequest req) {
        if (req == null || req.cases() == null || req.cases().isEmpty()) {
            throw new BadRequestException("Cần ít nhất 1 bài (cases) kèm điểm chuẩn để đo.");
        }
        if (req.cases().size() > MAX_CASES) {
            throw new BadRequestException("Tối đa " + MAX_CASES + " bài mỗi lần đo.");
        }
        List<String> models = (req.models() == null || req.models().isEmpty())
                ? DEFAULT_MODELS
                : req.models().stream().filter(m -> m != null && !m.isBlank()).map(String::trim).distinct().toList();
        if (models.isEmpty()) {
            throw new BadRequestException("Danh sách model không hợp lệ.");
        }
        if (models.size() > MAX_MODELS) {
            throw new BadRequestException("Tối đa " + MAX_MODELS + " model mỗi lần đo.");
        }

        List<ModelResult> results = new ArrayList<>();
        for (String model : models) {
            results.add(evalModel(model, req.cases()));
        }
        // Xếp theo MAE tăng dần (model chấm được & sai số nhỏ nhất lên đầu); model chấm fail hết xuống cuối.
        results.sort(Comparator.comparing(
                r -> r.mae() == null ? Double.MAX_VALUE : r.mae()));
        String best = results.isEmpty() || results.get(0).mae() == null ? null : results.get(0).model();
        return new GradingEvalResponse(results, best);
    }

    private ModelResult evalModel(String model, List<GradingEvalRequest.EvalCase> cases) {
        List<CaseScore> caseScores = new ArrayList<>();
        for (var c : cases) {
            Integer aiScore;
            try {
                aiScore = gradingService.gradeGermanEssay(c.topic(), c.essay(), model).score();
            } catch (Exception e) {
                log.warn("[GradingEval] model={} lỗi khi chấm 1 bài: {}", model, e.getMessage());
                aiScore = null;
            }
            caseScores.add(new CaseScore(c.referenceScore(), aiScore));
        }
        Metrics m = computeMetrics(caseScores);
        return new ModelResult(model, m.graded, m.failed, m.mae, m.meanBias, m.withinFiveRate, caseScores);
    }

    /** Số liệu thuần (tách để test không cần gọi AI). */
    record Metrics(int graded, int failed, Double mae, Double meanBias, Double withinFiveRate) {}

    static Metrics computeMetrics(List<CaseScore> cases) {
        int graded = 0, failed = 0, within = 0;
        long absSum = 0, signedSum = 0;
        for (CaseScore c : cases) {
            if (c.aiScore() == null) {
                failed++;
                continue;
            }
            graded++;
            int diff = c.aiScore() - c.referenceScore();
            absSum += Math.abs(diff);
            signedSum += diff;
            if (Math.abs(diff) <= WITHIN_THRESHOLD) {
                within++;
            }
        }
        if (graded == 0) {
            return new Metrics(0, failed, null, null, null);
        }
        double mae = (double) absSum / graded;
        double bias = (double) signedSum / graded;
        double withinRate = (double) within / graded;
        return new Metrics(graded, failed, round2(mae), round2(bias), round2(withinRate));
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
