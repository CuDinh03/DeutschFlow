package com.deutschflow.examspeaking.scoring;

import com.deutschflow.examspeaking.api.model.Ergebnisbogen;
import com.deutschflow.examspeaking.api.model.Ergebnisbogen.Msg;
import com.deutschflow.examspeaking.api.model.RubricDefinition;
import com.deutschflow.examspeaking.api.model.RubricRef;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * CODE quyết điểm (kế hoạch 2.4, nguyên tắc 2): band → điểm theo rubric_json; luật Erfüllung=lowest → Teil=0;
 * ×1,66 làm tròn half-up (A1); ngưỡng đỗ và ngưỡng nói riêng. Tiêu chí không có tín hiệu bị loại khỏi
 * cả tử lẫn mẫu và ghi chú rõ — không bịa số.
 */
@Component
public class RubricScorer {

    public Ergebnisbogen score(RubricRef ref, RubricDefinition rubric, PassAssessment pass) {
        List<Ergebnisbogen.PartResult> parts = new ArrayList<>();
        List<String> notes = new ArrayList<>(pass.notes());
        List<Msg> noteMsgs = new ArrayList<>(pass.noteMsgs());
        for (RubricDefinition.RubricPart rp : rubric.parts()) {
            PassAssessment.PartAssessment pa = pass.parts().get(rp.teilNo());
            parts.add(scorePart(rubric, rp, pa, notes, noteMsgs));
        }
        List<Ergebnisbogen.CriterionResult> global = new ArrayList<>();
        for (RubricDefinition.RubricCriterion c : rubric.global()) {
            PassAssessment.CriterionAssessment ca = pass.global().get(c.code());
            global.add(scoreCriterion(rubric, c, ca, false));
        }
        return Totals.assemble(ref, rubric, parts, global, pass.errors(), notes, noteMsgs, 1, null, null);
    }

    private Ergebnisbogen.PartResult scorePart(RubricDefinition rubric, RubricDefinition.RubricPart rp,
                                               PassAssessment.PartAssessment pa, List<String> notes, List<Msg> noteMsgs) {
        List<Ergebnisbogen.CriterionResult> results = new ArrayList<>();
        boolean zeroed = false;
        if (pa != null && pa.silent()) {
            // N1c-1: thí sinh không nói gì → mọi tiêu chí/nhiệm vụ band thấp nhất, 0 điểm, VẪN TÍNH trong mẫu số.
            String lowest = rubric.lowestBand();
            List<Msg> why = List.of(Msg.of("silentTeilCriterion"));
            if (rubric.scale() == RubricDefinition.BandScale.VHN) {
                for (RubricDefinition.RubricItem item : rp.items()) {
                    results.add(new Ergebnisbogen.CriterionResult(item.code(), item.label(), lowest, 0, item.max(), true, "high", List.of(), why));
                }
            } else {
                for (RubricDefinition.RubricCriterion c : rp.criteria()) {
                    results.add(new Ergebnisbogen.CriterionResult(c.code(), c.label(), lowest, 0, c.max(), true, "high", List.of(), why));
                }
            }
            double silentMax = results.stream().mapToDouble(Ergebnisbogen.CriterionResult::max).sum();
            return new Ergebnisbogen.PartResult(rp.teilNo(), results, 0, round2(silentMax), false, null);
        }
        if (rubric.scale() == RubricDefinition.BandScale.VHN) {
            for (RubricDefinition.RubricItem item : rp.items()) {
                PassAssessment.CriterionAssessment ca = pa == null ? null : pa.items().get(item.code());
                results.add(scoreItem(item, ca));
            }
        } else {
            PassAssessment.CriterionAssessment erf = pa == null ? null : pa.criteria().get("ERFUELLUNG");
            zeroed = rubric.zeroPartIfErfuellungLowest() && erf != null && erf.scored()
                    && rubric.lowestBand().equals(erf.band());
            if (zeroed) {
                notes.add("Teil " + rp.teilNo() + ": Erfüllung = " + rubric.lowestBand()
                        + " → toàn bộ Teil 0 điểm (luật của hệ " + rubric.scheme() + ").");
                noteMsgs.add(Msg.of("erfuellungZero", "teil", rp.teilNo(), "band", rubric.lowestBand(),
                        "scheme", rubric.scheme()));
            }
            for (RubricDefinition.RubricCriterion c : rp.criteria()) {
                PassAssessment.CriterionAssessment ca = pa == null ? null : pa.criteria().get(c.code());
                results.add(scoreCriterion(rubric, c, ca, zeroed));
            }
        }
        double points = results.stream().filter(Ergebnisbogen.CriterionResult::scored).mapToDouble(Ergebnisbogen.CriterionResult::points).sum();
        double max = results.stream().filter(Ergebnisbogen.CriterionResult::scored).mapToDouble(Ergebnisbogen.CriterionResult::max).sum();
        return new Ergebnisbogen.PartResult(rp.teilNo(), results, round2(points), round2(max), zeroed,
                pa == null ? null : pa.comment());
    }

    private Ergebnisbogen.CriterionResult scoreItem(RubricDefinition.RubricItem item, PassAssessment.CriterionAssessment ca) {
        if (ca == null || !ca.scored() || ca.band() == null) {
            return new Ergebnisbogen.CriterionResult(item.code(), item.label(), null, 0, item.max(), false, "none",
                    ca == null ? List.of() : ca.evidence(),
                    ca == null ? List.of(Msg.of("noAssessment")) : ca.evidenceMsgs());
        }
        double frac = BandScales.VHN_FRACTIONS.getOrDefault(ca.band(), 0.0);
        return new Ergebnisbogen.CriterionResult(item.code(), item.label(), ca.band(), round2(item.max() * frac),
                item.max(), true, ca.confidence(), ca.evidence(), ca.evidenceMsgs());
    }

    private Ergebnisbogen.CriterionResult scoreCriterion(RubricDefinition rubric, RubricDefinition.RubricCriterion c,
                                                         PassAssessment.CriterionAssessment ca, boolean zeroed) {
        if (ca == null || !ca.scored() || ca.band() == null) {
            return new Ergebnisbogen.CriterionResult(c.code(), c.label(), null, 0, c.max(), false, "none",
                    ca == null ? List.of() : ca.evidence(),
                    ca == null ? List.of(Msg.of("noAssessment")) : ca.evidenceMsgs());
        }
        double points;
        if (!c.bandPoints().isEmpty()) {
            points = c.bandPoints().getOrDefault(ca.band(), 0.0);
        } else {
            Map<String, Double> fractions = rubric.bandFractions().isEmpty()
                    ? BandScales.defaultFractions(rubric.scale()) : rubric.bandFractions();
            points = c.max() * fractions.getOrDefault(ca.band(), 0.0);
        }
        if (zeroed) {
            points = 0;
        }
        return new Ergebnisbogen.CriterionResult(c.code(), c.label(), ca.band(), round2(points), c.max(), true,
                ca.confidence(), ca.evidence(), ca.evidenceMsgs());
    }

    static double round2(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    /** Tổng, quy thang, đỗ/trượt — dùng chung cho 1 pass và cho bản gộp nhiều pass. */
    static final class Totals {

        private Totals() {}

        static Ergebnisbogen assemble(RubricRef ref, RubricDefinition rubric,
                                      List<Ergebnisbogen.PartResult> parts,
                                      List<Ergebnisbogen.CriterionResult> global,
                                      List<Ergebnisbogen.ErrorItem> errors,
                                      List<String> notesIn, List<Msg> noteMsgsIn,
                                      int passes, Double lowOverride, Double highOverride) {
            List<String> notes = new ArrayList<>(notesIn);
            List<Msg> noteMsgs = new ArrayList<>(noteMsgsIn);
            double rawPoints = parts.stream().mapToDouble(Ergebnisbogen.PartResult::points).sum()
                    + global.stream().filter(Ergebnisbogen.CriterionResult::scored).mapToDouble(Ergebnisbogen.CriterionResult::points).sum();
            double rawMax = parts.stream().mapToDouble(Ergebnisbogen.PartResult::max).sum()
                    + global.stream().filter(Ergebnisbogen.CriterionResult::scored).mapToDouble(Ergebnisbogen.CriterionResult::max).sum();

            double total;
            double maxPoints;
            if (rubric.rawMultiplier() != null) {
                total = roundHalfUp(rawPoints * rubric.rawMultiplier());
                maxPoints = roundHalfUp(rawMax * rubric.rawMultiplier());
            } else {
                total = round2(rawPoints);
                maxPoints = round2(rawMax);
            }
            double officialMax = rubric.officialMax();
            boolean reducedMax = maxPoints + 0.01 < officialMax;
            if (reducedMax) {
                notes.add("Một số tiêu chí chưa chấm được (không có tín hiệu) → điểm tính trên "
                        + fmt(maxPoints) + "/" + fmt(officialMax) + "; đỗ/trượt quy đổi tỉ lệ.");
                noteMsgs.add(Msg.of("reducedMaxNote", "max", fmt(maxPoints), "official", fmt(officialMax)));
            }
            long unscored = global.stream().filter(c -> !c.scored()).count()
                    + parts.stream().flatMap(p -> p.criteria().stream()).filter(c -> !c.scored()).count();
            if (unscored > 0) {
                notes.add(unscored + " tiêu chí/nhiệm vụ chưa chấm được.");
                noteMsgs.add(Msg.of("unscoredCount", "count", unscored));
            }

            double normalized = maxPoints > 0 ? total * officialMax / maxPoints : 0;
            Boolean passed = null;
            String rule;
            Msg ruleMsg;
            if (rubric.speakingOnlyMin() != null) {
                passed = normalized + 1e-9 >= rubric.speakingOnlyMin();
                rule = "Ngưỡng nói riêng ≥" + fmt(rubric.speakingOnlyMin()) + "/" + fmt(officialMax)
                        + " (kỳ thi đầy đủ còn đòi phần viết đạt ngưỡng riêng).";
                ruleMsg = Msg.of("passSpeakingOnly", "min", fmt(rubric.speakingOnlyMin()), "max", fmt(officialMax));
            } else if (rubric.passMin() != null) {
                passed = normalized + 1e-9 >= rubric.passMin();
                rule = "Modul đỗ khi ≥" + fmt(rubric.passMin()) + "/" + fmt(officialMax) + ".";
                ruleMsg = Msg.of("passModule", "min", fmt(rubric.passMin()), "max", fmt(officialMax));
            } else {
                rule = "Hệ này không có ngưỡng nói riêng — điểm nói cộng vào tổng kỳ thi (xem ghi chú rubric).";
                ruleMsg = Msg.of("passNoThreshold");
            }
            double low = lowOverride == null ? total : lowOverride;
            double high = highOverride == null ? total : highOverride;
            // F-17: các pass cho kết luận khác nhau quanh ngưỡng → "sát ngưỡng", không tuyên bố dứt khoát.
            Double threshold = rubric.speakingOnlyMin() != null ? rubric.speakingOnlyMin() : rubric.passMin();
            boolean borderline = false;
            if (threshold != null && maxPoints > 0 && low < high) {
                double lowN = low * officialMax / maxPoints;
                double highN = high * officialMax / maxPoints;
                borderline = lowN + 1e-9 < threshold && highN + 1e-9 >= threshold;
            }
            if (borderline) {
                notes.add("Khoảng điểm " + fmt(round2(low)) + "–" + fmt(round2(high)) + " vắt qua ngưỡng "
                        + fmt(threshold) + " — kết luận đỗ/trượt chưa chắc chắn.");
                noteMsgs.add(Msg.of("borderline", "low", fmt(round2(low)), "high", fmt(round2(high)),
                        "min", fmt(threshold)));
            }
            return new Ergebnisbogen(ref, parts, global, total, low, high, maxPoints, officialMax, passed, rule,
                    errors, notes, passes, ruleMsg, noteMsgs, borderline);
        }

        static double roundHalfUp(double v) {
            return BigDecimal.valueOf(v).setScale(0, RoundingMode.HALF_UP).doubleValue();
        }

        private static String fmt(double v) {
            return v == Math.rint(v) ? String.valueOf((long) v) : String.valueOf(v);
        }
    }
}
