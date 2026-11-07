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
 * <p>Ba Teil khách quan đo Lesen, Sprachbausteine, Hören; Viết và Nói là tự đánh giá bốn mức. Mỗi
 * phần ra một tỉ lệ đạt 0–1; tỉ lệ đó áp cho mọi Teil cùng phần khi lộ trình xếp Teil ưu tiên.
 */
public final class ExamDiagnosticScoring {

    /** Teil làm trong bài chẩn đoán, theo thứ tự làm. Ngắn nhất của mỗi phần. */
    public static final List<String> TEILE = List.of("LESEN-1", "SPRACHBAUSTEINE-1", "HOEREN-1");
    /** Phần tự đánh giá. */
    public static final List<String> SELF_SKILLS = List.of("SCHREIBEN", "SPRECHEN");
    /** Mức tự đánh giá 1–4 ⇒ tỉ lệ đạt ước lượng. Mức 1 "chưa làm được", mức 4 "làm tốt". */
    static final double[] SELF_RATIO = {0, 0.3, 0.5, 0.65, 0.8};

    private ExamDiagnosticScoring() {}

    public static double selfRatio(int level) {
        if (level < 1 || level > 4) throw new IllegalArgumentException("level 1–4");
        return SELF_RATIO[level];
    }

    /**
     * Tỉ lệ đạt từng phần.
     *
     * @param scores khoá Teil → {điểm, tối đa} của ba Teil khách quan
     * @param self   phần → mức tự đánh giá 1–4
     */
    public static Map<String, Double> ratios(Map<String, double[]> scores, Map<String, Integer> self) {
        Map<String, Double> out = new LinkedHashMap<>();
        scores.forEach((key, s) -> {
            if (s[1] > 0) out.put(key.substring(0, key.lastIndexOf('-')), round(s[0] / s[1]));
        });
        self.forEach((skill, level) -> out.put(skill, selfRatio(level)));
        return out;
    }

    /**
     * Bốn kỹ năng hiện ở màn kết quả (%), Lesen gồm Sprachbausteine theo điểm.
     *
     * @return kỹ năng → % (0–100); kỹ năng không có dữ liệu thì không có khoá
     */
    public static Map<String, Integer> skills(Map<String, double[]> scores, Map<String, Integer> self) {
        Map<String, Integer> out = new LinkedHashMap<>();
        double score = 0;
        double max = 0;
        for (Map.Entry<String, double[]> e : scores.entrySet()) {
            if (e.getKey().startsWith("LESEN-") || e.getKey().startsWith("SPRACHBAUSTEINE-")) {
                score += e.getValue()[0];
                max += e.getValue()[1];
            }
        }
        if (max > 0) out.put("LESEN", (int) Math.round(score / max * 100));
        double[] hoeren = scores.get("HOEREN-1");
        if (hoeren != null && hoeren[1] > 0) out.put("HOEREN", (int) Math.round(hoeren[0] / hoeren[1] * 100));
        for (String skill : SELF_SKILLS) {
            Integer level = self.get(skill);
            if (level != null) out.put(skill, (int) Math.round(selfRatio(level) * 100));
        }
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

    private static double round(double v) {
        return Math.round(v * 1000) / 1000.0;
    }
}
