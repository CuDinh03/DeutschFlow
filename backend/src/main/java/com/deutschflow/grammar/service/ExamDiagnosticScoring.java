package com.deutschflow.grammar.service;

import com.deutschflow.grammar.dto.ExamBudgetDto.TeilLoss;
import com.deutschflow.grammar.service.ExamPlanBlueprints.Blueprint;
import com.deutschflow.grammar.service.ExamPlanBlueprints.Teil;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Chấm bài chẩn đoán (đợt (f) làm mới Luyện thi, 07/11/2026). Hàm thuần.
 *
 * <p>Bốn Teil của một đề telc B1 đo Lesen, Sprachbausteine, Hören (chấm theo đáp án) và Schreiben (AI
 * chấm theo phiếu telc B1, 45 điểm). Sprechen lấy từ một lượt thi thử phần nói telc B1 (AI chấm theo
 * rubric telc). Mỗi phần ra một tỉ lệ đạt 0–1; tỉ lệ đó áp cho mọi Teil cùng phần khi lộ trình xếp
 * Teil ưu tiên.
 */
public final class ExamDiagnosticScoring {

    /** Teil làm trong bài chẩn đoán, theo thứ tự làm (Teil ngắn nhất của mỗi phần; Viết đủ đề thật). */
    public static final List<String> TEILE = List.of("LESEN-1", "SPRACHBAUSTEINE-1", "HOEREN-1", "SCHREIBEN-1");
    public static final String ORAL = "SPRECHEN";

    private ExamDiagnosticScoring() {}

    /**
     * Tỉ lệ đạt từng phần.
     *
     * @param scores khoá Teil → {điểm, tối đa}
     * @param oral   {điểm, tối đa} của lượt thi nói, {@code null} nếu chưa có
     */
    public static Map<String, Double> ratios(Map<String, double[]> scores, double[] oral) {
        Map<String, Double> out = new LinkedHashMap<>();
        scores.forEach((key, s) -> {
            if (s[1] > 0) out.put(key.substring(0, key.lastIndexOf('-')), round(s[0] / s[1]));
        });
        if (oral != null && oral[1] > 0) out.put(ORAL, round(oral[0] / oral[1]));
        return out;
    }

    /**
     * Bốn kỹ năng hiện ở màn kết quả (%), Lesen gồm Sprachbausteine theo điểm.
     *
     * @return kỹ năng → % (0–100); kỹ năng không có dữ liệu thì không có khoá
     */
    public static Map<String, Integer> skills(Map<String, double[]> scores, double[] oral) {
        Map<String, Integer> out = new LinkedHashMap<>();
        double score = 0;
        double max = 0;
        for (Map.Entry<String, double[]> e : scores.entrySet()) {
            if (e.getKey().startsWith("LESEN-") || e.getKey().startsWith("SPRACHBAUSTEINE-")) {
                score += e.getValue()[0];
                max += e.getValue()[1];
            }
        }
        if (max > 0) out.put("LESEN", pct(score, max));
        double[] hoeren = scores.get("HOEREN-1");
        if (hoeren != null && hoeren[1] > 0) out.put("HOEREN", pct(hoeren[0], hoeren[1]));
        double[] writing = scores.get("SCHREIBEN-1");
        if (writing != null && writing[1] > 0) out.put("SCHREIBEN", pct(writing[0], writing[1]));
        if (oral != null && oral[1] > 0) out.put(ORAL, pct(oral[0], oral[1]));
        return out;
    }

    /** Dòng điểm mất ước lượng cho mọi Teil của đề, để {@link ExamPlanGenerator#rank} xếp ưu tiên. */
    public static List<TeilLoss> losses(Map<String, Double> ratios, Blueprint blueprint) {
        List<TeilLoss> out = new ArrayList<>();
        for (Teil teil : blueprint.teile()) {
            Double r = ratios.get(teil.section());
            if (r == null) continue;
            double earned = teil.max() * r;
            out.add(new TeilLoss(teil.section(), teil.teil(), teil.max(), earned, teil.max() - earned,
                    null, null, null, false));
        }
        return out;
    }

    private static int pct(double score, double max) {
        return (int) Math.round(score / max * 100);
    }

    private static double round(double v) {
        return Math.round(v * 1000) / 1000.0;
    }
}
