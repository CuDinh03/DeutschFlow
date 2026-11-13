package com.deutschflow.grammar.service;

import com.deutschflow.grammar.dto.ExamBudgetDto.TeilLoss;
import com.deutschflow.grammar.service.ExamPlanBlueprints.Blueprint;
import com.deutschflow.grammar.service.ExamPlanBlueprints.Teil;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Chấm bài chẩn đoán (đợt (f) làm mới Luyện thi, 07/11/2026; đủ mọi Teil từ 13/11/2026). Hàm thuần.
 *
 * <p>Bài chẩn đoán gồm MỌI Teil phần viết của một đề telc B1, như đề thật: Leseverstehen 1–3,
 * Sprachbausteine 1–2, Hörverstehen 1–3 (chấm theo đáp án) và Schreiben (AI chấm theo phiếu telc B1,
 * 45 điểm). Sprechen lấy từ một lượt thi thử phần nói telc B1 (AI chấm theo rubric telc, 75 điểm).
 *
 * <p>Điểm và điểm tối đa của từng Teil là của chính đề (điểm từng câu / {@code point_per_item}, cùng
 * trọng số mà thi thử dùng ở {@link ExamBudgetService}): telc B1 là Lesen 25+25+25, Sprachbausteine
 * 15+15, Hören 25+25+25, Schreiben 45. Điểm một phần/kỹ năng = tổng điểm ÷ tổng điểm tối đa các Teil
 * của nó, nên Teil nặng điểm hơn thì kéo kết quả nhiều hơn — đúng như đề thật.
 */
public final class ExamDiagnosticScoring {

    /** Teil làm trong bài chẩn đoán, theo thứ tự thi thật (sau đó là phần Nói). */
    public static final List<String> TEILE = List.of(
            "LESEN-1", "LESEN-2", "LESEN-3",
            "SPRACHBAUSTEINE-1", "SPRACHBAUSTEINE-2",
            "HOEREN-1", "HOEREN-2", "HOEREN-3",
            "SCHREIBEN-1");
    /**
     * Bốn Teil của bài chẩn đoán bản ngắn (trước 13/11/2026). Đề nào cũng phải có đủ bốn Teil này thì
     * mới dùng được; đề thiếu Teil 2/3 (lượt cũ có thể đã chọn đề như vậy) thì chỉ làm các Teil đề có.
     */
    public static final List<String> CORE_TEILE = List.of("LESEN-1", "SPRACHBAUSTEINE-1", "HOEREN-1", "SCHREIBEN-1");
    public static final String ORAL = "SPRECHEN";

    private ExamDiagnosticScoring() {}

    /** Các Teil chẩn đoán mà đề có, giữ thứ tự thi thật. */
    public static List<String> present(List<String> examTeile) {
        return TEILE.stream().filter(examTeile::contains).toList();
    }

    /**
     * Tỉ lệ đạt từng phần (gộp mọi Teil của phần theo điểm).
     *
     * @param scores khoá Teil → {điểm, tối đa}
     * @param oral   {điểm, tối đa} của lượt thi nói, {@code null} nếu chưa có
     */
    public static Map<String, Double> ratios(Map<String, double[]> scores, double[] oral) {
        Map<String, double[]> sums = new LinkedHashMap<>();
        scores.forEach((key, s) -> {
            if (s[1] <= 0) return;
            double[] sum = sums.computeIfAbsent(sectionOf(key), k -> new double[2]);
            sum[0] += s[0];
            sum[1] += s[1];
        });
        Map<String, Double> out = new LinkedHashMap<>();
        sums.forEach((section, sum) -> out.put(section, round(sum[0] / sum[1])));
        if (oral != null && oral[1] > 0) out.put(ORAL, round(oral[0] / oral[1]));
        return out;
    }

    /** Tỉ lệ đạt từng Teil đã chấm (khoá {@code LESEN-2}); phần Nói không tách Teil nên không có ở đây. */
    public static Map<String, Double> teilRatios(Map<String, double[]> scores) {
        Map<String, Double> out = new LinkedHashMap<>();
        scores.forEach((key, s) -> {
            if (s[1] > 0) out.put(key, round(s[0] / s[1]));
        });
        return out;
    }

    /**
     * Bốn kỹ năng hiện ở màn kết quả (%): Lesen gồm Sprachbausteine, mỗi kỹ năng gộp mọi Teil theo điểm.
     *
     * @return kỹ năng → % (0–100); kỹ năng không có dữ liệu thì không có khoá
     */
    public static Map<String, Integer> skills(Map<String, double[]> scores, double[] oral) {
        Map<String, double[]> sums = new LinkedHashMap<>();
        for (String skill : List.of("LESEN", "HOEREN", "SCHREIBEN")) sums.put(skill, new double[2]);
        scores.forEach((key, s) -> {
            String section = sectionOf(key);
            double[] sum = sums.get("SPRACHBAUSTEINE".equals(section) ? "LESEN" : section);
            if (sum == null || s[1] <= 0) return;
            sum[0] += s[0];
            sum[1] += s[1];
        });
        Map<String, Integer> out = new LinkedHashMap<>();
        sums.forEach((skill, sum) -> {
            if (sum[1] > 0) out.put(skill, pct(sum[0], sum[1]));
        });
        if (oral != null && oral[1] > 0) out.put(ORAL, pct(oral[0], oral[1]));
        return out;
    }

    /** Như {@link #losses(Map, Map, Blueprint)} khi kết quả không có tỉ lệ từng Teil (bài bản ngắn). */
    public static List<TeilLoss> losses(Map<String, Double> ratios, Blueprint blueprint) {
        return losses(ratios, Map.of(), blueprint);
    }

    /**
     * Dòng điểm mất ước lượng cho mọi Teil của đề, để {@link ExamPlanGenerator#rank} xếp ưu tiên.
     * Teil đã làm trong bài chẩn đoán dùng tỉ lệ của chính nó; Teil không có (kết quả bản ngắn chỉ đo
     * Teil 1, ba Teil của phần Nói) dùng tỉ lệ của cả phần.
     *
     * @param ratios     phần → tỉ lệ đạt
     * @param teilRatios khoá Teil ({@code LESEN-2}) → tỉ lệ đạt; rỗng với kết quả bản ngắn
     */
    public static List<TeilLoss> losses(Map<String, Double> ratios, Map<String, Double> teilRatios, Blueprint blueprint) {
        List<TeilLoss> out = new ArrayList<>();
        for (Teil teil : blueprint.teile()) {
            Double r = teilRatios.get(teil.section() + "-" + teil.teil());
            if (r == null) r = ratios.get(teil.section());
            if (r == null) continue;
            double earned = teil.max() * r;
            out.add(new TeilLoss(teil.section(), teil.teil(), teil.max(), earned, teil.max() - earned,
                    null, null, null, false));
        }
        return out;
    }

    private static String sectionOf(String key) {
        int dash = key.lastIndexOf('-');
        return dash < 0 ? key : key.substring(0, dash);
    }

    private static int pct(double score, double max) {
        return (int) Math.round(score / max * 100);
    }

    private static double round(double v) {
        return Math.round(v * 1000) / 1000.0;
    }
}
