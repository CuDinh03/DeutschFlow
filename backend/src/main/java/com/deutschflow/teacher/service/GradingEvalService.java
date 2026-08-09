package com.deutschflow.teacher.service;

import com.deutschflow.ai.tier.LlmTier;
import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.quota.AiCostEstimator;
import com.deutschflow.speaking.ai.AiChatCompletionResult;
import com.deutschflow.speaking.ai.TokenUsage;
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
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/**
 * Đo độ CHUẨN của các model AI khi chấm Schreiben so với điểm chuẩn của giám khảo (admin) —
 * harness F1 của khung AI tier.
 *
 * <p>"Chuẩn nhất" là câu hỏi thực nghiệm: harness chấm cùng một bộ bài (kèm điểm người chấm) bằng
 * từng model rồi đo sai số tuyệt đối trung bình (MAE), lệch có dấu, tỉ lệ lệch ≤5/≤10 điểm, thời
 * gian và chi phí — xếp hạng theo MAE. Tái dùng đúng lõi
 * {@link GradingService#gradeGermanEssay(String, String, String)} nên prompt/JSON-mode giống hệt
 * sản phẩm thật.
 *
 * <p><b>Hai thứ phải đọc TRƯỚC khi tin bảng xếp hạng:</b>
 * <ul>
 *   <li>{@code feedbackMissing} — bài có điểm nhưng mất nhận xét nghĩa là JSON bị cắt giữa chừng.
 *       {@code parseScore} có regex fallback nên vẫn ra điểm, và điểm đó KHÔNG đại diện cho chất
 *       lượng chấm của model (FW.7). {@code feedbackMissing > 0} ⇒ nới {@code maxTokens} rồi đo lại.</li>
 *   <li>{@code maxTokens} — model mới dài dòng gấp 4–10× {@code gpt-oss-120b} (đo 09/08), nên so
 *       hai model ở hai ngân sách khác nhau là so hai thứ khác nhau.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GradingEvalService {

    private static final int MAX_MODELS = 6;
    /** F1.2 cần ~100 bài. 100 bài × 4 model là ~400 lượt gọi AI ⇒ xem cảnh báo ở {@link #run}. */
    private static final int MAX_CASES = 100;
    private static final int WITHIN_THRESHOLD = 5;
    /** "Lệch 1 band" trên thang 100 điểm = 10 điểm (band = bậc 10 điểm). */
    private static final int BAND_POINTS = 10;
    private static final int DEFAULT_PARALLELISM = 2;
    /** Trần song song: semaphore chat của client mặc định 5 và harness CHIA SẺ nó với traffic thật. */
    private static final int MAX_PARALLELISM = 4;
    /** Quá ngưỡng này thì một request HTTP chạy hàng chục phút — cảnh báo để người chạy tự chia lô. */
    private static final int LONG_RUN_CALL_WARNING = 100;

    /**
     * Bộ model mặc định khi request không chỉ định — baseline hiện trạng để có mốc so.
     *
     * <p>Cố tình KHÔNG liệt kê ứng viên P3 ở đây: mỗi ứng viên cần ngân sách token riêng (đo 09/08:
     * ở 800 token cả ba đều cụt JSON) nên phải truyền tường minh kèm {@code maxTokens}, không được
     * để nó lọt vào một lượt chạy mặc định rồi ra số vô nghĩa.
     */
    static final List<String> DEFAULT_MODELS = List.of(
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b");

    private final GradingService gradingService;
    private final AiCostEstimator aiCostEstimator;

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
        LlmTier tier = parseTier(req.tier());
        int maxTokens = req.maxTokens() == null ? 0 : Math.max(0, req.maxTokens());
        int parallelism = clampParallelism(req.parallelism());

        int calls = models.size() * req.cases().size();
        if (calls > LONG_RUN_CALL_WARNING) {
            log.warn("[GradingEval] {} lượt gọi AI ({} model × {} bài, song song {}) — request này sẽ "
                            + "chạy rất lâu; nên chia lô nhỏ hơn để tránh timeout ở proxy/client.",
                    calls, models.size(), req.cases().size(), parallelism);
        }
        log.info("[GradingEval] bắt đầu: tier={} maxTokens={} song song={} models={}",
                tier, maxTokens > 0 ? maxTokens : "mặc định", parallelism, models);

        List<ModelResult> results = new ArrayList<>();
        ExecutorService pool = Executors.newFixedThreadPool(parallelism);
        try {
            for (String model : models) {
                results.add(evalModel(model, req.cases(), tier, maxTokens, pool));
            }
        } finally {
            pool.shutdown();
        }
        // Xếp theo MAE tăng dần (model chấm được & sai số nhỏ nhất lên đầu); model chấm fail hết xuống cuối.
        results.sort(Comparator.comparing(r -> r.mae() == null ? Double.MAX_VALUE : r.mae()));
        String best = results.isEmpty() || results.get(0).mae() == null ? null : results.get(0).model();
        return new GradingEvalResponse(results, best, tier.name(),
                maxTokens > 0 ? maxTokens : GradingService.GRADING_MAX_TOKENS);
    }

    private LlmTier parseTier(String raw) {
        if (raw == null || raw.isBlank()) {
            return LlmTier.GRADING_EXAM;
        }
        String name = raw.trim().toUpperCase(Locale.ROOT).replace('-', '_');
        if (!LlmTier.GRADING_EXAM.name().equals(name) && !LlmTier.GRADING_DAILY.name().equals(name)) {
            // Chấm bài chỉ có nghĩa ở hai tầng này; cho phép tầng khác là mời người dùng đo một
            // cấu hình không tồn tại trong sản phẩm (vd chat-free với ngân sách 800).
            throw new BadRequestException("tier chỉ nhận GRADING_EXAM hoặc GRADING_DAILY, nhận: " + raw);
        }
        return LlmTier.valueOf(name);
    }

    private int clampParallelism(Integer requested) {
        if (requested == null) {
            return DEFAULT_PARALLELISM;
        }
        return Math.max(1, Math.min(MAX_PARALLELISM, requested));
    }

    private ModelResult evalModel(String model, List<GradingEvalRequest.EvalCase> cases,
                                  LlmTier tier, int maxTokens, ExecutorService pool) {
        List<Future<CaseScore>> futures = new ArrayList<>(cases.size());
        for (var c : cases) {
            futures.add(pool.submit(() -> gradeOne(model, c, tier, maxTokens)));
        }
        List<CaseScore> caseScores = new ArrayList<>(cases.size());
        for (int i = 0; i < futures.size(); i++) {
            try {
                caseScores.add(futures.get(i).get());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Đo bị ngắt giữa chừng", e);
            } catch (Exception e) {
                log.warn("[GradingEval] model={} bài #{} lỗi: {}", model, i, e.getMessage());
                caseScores.add(new CaseScore(cases.get(i).referenceScore(), null));
            }
        }
        return aggregate(model, caseScores);
    }

    /** Chấm một bài, không để ngoại lệ nào thoát ra (một bài lỗi không được làm sập cả lượt đo). */
    private CaseScore gradeOne(String model, GradingEvalRequest.EvalCase c, LlmTier tier, int maxTokens) {
        long t0 = System.nanoTime();
        try {
            var grade = gradingService.gradeGermanEssay(c.topic(), c.essay(), model, tier, maxTokens);
            long ms = (System.nanoTime() - t0) / 1_000_000L;
            // "Có điểm nhưng không có nhận xét" = dấu hiệu JSON bị cắt (FW.7). Phải đếm riêng, nếu
            // không thì model bị cắt trông như model chấm được — chỉ MAE hơi lệch.
            boolean feedbackMissing = grade.score() != null
                    && (grade.feedback() == null || AiGradeResultParser.NO_FEEDBACK.equals(grade.feedback()));
            AiChatCompletionResult raw = grade.raw();
            TokenUsage usage = raw == null ? null : raw.usage();
            return new CaseScore(c.referenceScore(), grade.score(), feedbackMissing, ms,
                    usage == null ? null : usage.promptTokens(),
                    usage == null ? null : usage.cachedPromptTokens(),
                    usage == null ? null : usage.completionTokens());
        } catch (Exception e) {
            long ms = (System.nanoTime() - t0) / 1_000_000L;
            log.warn("[GradingEval] model={} lỗi khi chấm 1 bài sau {}ms: {}", model, ms, e.getMessage());
            return new CaseScore(c.referenceScore(), null, false, ms, null, null, null);
        }
    }

    /** Số liệu thuần (tách để test không cần gọi AI). */
    record Metrics(int graded, int failed, Double mae, Double meanBias,
                   Double withinFiveRate, Double withinTenRate, int feedbackMissing) {}

    static Metrics computeMetrics(List<CaseScore> cases) {
        int graded = 0, failed = 0, within = 0, withinBand = 0, feedbackMissing = 0;
        long absSum = 0, signedSum = 0;
        for (CaseScore c : cases) {
            if (c.feedbackMissing()) {
                feedbackMissing++;
            }
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
            if (Math.abs(diff) <= BAND_POINTS) {
                withinBand++;
            }
        }
        if (graded == 0) {
            return new Metrics(0, failed, null, null, null, null, feedbackMissing);
        }
        return new Metrics(graded, failed,
                round2((double) absSum / graded),
                round2((double) signedSum / graded),
                round2((double) within / graded),
                round2((double) withinBand / graded),
                feedbackMissing);
    }

    private ModelResult aggregate(String model, List<CaseScore> caseScores) {
        Metrics m = computeMetrics(caseScores);

        List<Long> latencies = caseScores.stream()
                .map(CaseScore::latencyMs).filter(java.util.Objects::nonNull).sorted().toList();
        int maxCompletion = caseScores.stream()
                .map(CaseScore::completionTokens).filter(java.util.Objects::nonNull)
                .mapToInt(Integer::intValue).max().orElse(0);

        double costUsd = 0.0;
        for (CaseScore c : caseScores) {
            if (c.promptTokens() == null) {
                continue;
            }
            costUsd += aiCostEstimator.costUsd(model,
                    c.promptTokens(),
                    c.cachedTokens() == null ? 0 : c.cachedTokens(),
                    c.completionTokens() == null ? 0 : c.completionTokens());
        }
        Long costPerCaseVnd = caseScores.isEmpty() ? null
                : aiCostEstimator.toVnd(costUsd / caseScores.size());

        return new ModelResult(model, m.graded(), m.failed(), m.mae(), m.meanBias(),
                m.withinFiveRate(), m.withinTenRate(), m.feedbackMissing(), maxCompletion,
                percentile(latencies, 50), percentile(latencies, 95),
                aiCostEstimator.roundUsd(costUsd), costPerCaseVnd, caseScores);
    }

    /** Phân vị theo "nearest rank" — đủ cho n nhỏ của một lượt calibration. */
    static Long percentile(List<Long> sortedAsc, int p) {
        if (sortedAsc == null || sortedAsc.isEmpty()) {
            return null;
        }
        int idx = (int) Math.ceil(p / 100.0 * sortedAsc.size()) - 1;
        return sortedAsc.get(Math.max(0, Math.min(sortedAsc.size() - 1, idx)));
    }

    /**
     * Xuất CSV để dán vào báo cáo calibration (F1.4) — một dòng mỗi model, cột đọc được bằng mắt.
     * Ngân sách token đứng ngay trong header vì kết quả không có nghĩa nếu tách khỏi nó.
     */
    public static String toCsv(GradingEvalResponse resp) {
        StringBuilder sb = new StringBuilder();
        sb.append("# tier=").append(resp.tier()).append(" maxTokens=").append(resp.maxTokens()).append('\n');
        sb.append("model,graded,failed,mae,meanBias,withinFiveRate,withinTenRate,feedbackMissing,")
                .append("maxCompletionTokens,latencyP50Ms,latencyP95Ms,costUsd,costPerCaseVnd\n");
        for (ModelResult r : resp.results()) {
            sb.append(csvCell(r.model())).append(',')
                    .append(r.graded()).append(',')
                    .append(r.failed()).append(',')
                    .append(nullToBlank(r.mae())).append(',')
                    .append(nullToBlank(r.meanBias())).append(',')
                    .append(nullToBlank(r.withinFiveRate())).append(',')
                    .append(nullToBlank(r.withinTenRate())).append(',')
                    .append(r.feedbackMissing()).append(',')
                    .append(r.maxCompletionTokens()).append(',')
                    .append(nullToBlank(r.latencyP50Ms())).append(',')
                    .append(nullToBlank(r.latencyP95Ms())).append(',')
                    .append(nullToBlank(r.costUsd())).append(',')
                    .append(nullToBlank(r.costPerCaseVnd())).append('\n');
        }
        return sb.toString();
    }

    private static String csvCell(String raw) {
        if (raw == null) {
            return "";
        }
        // Slug Fireworks có dấu "/" (vô hại) nhưng cứ quote cho chắc nếu có dấu phẩy/ngoặc kép.
        if (raw.contains(",") || raw.contains("\"")) {
            return '"' + raw.replace("\"", "\"\"") + '"';
        }
        return raw;
    }

    private static String nullToBlank(Object v) {
        return v == null ? "" : String.valueOf(v);
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
