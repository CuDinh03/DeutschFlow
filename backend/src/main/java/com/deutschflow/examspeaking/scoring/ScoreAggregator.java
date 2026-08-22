package com.deutschflow.examspeaking.scoring;

import com.deutschflow.examspeaking.api.model.Ergebnisbogen;
import com.deutschflow.examspeaking.api.model.RubricDefinition;
import com.deutschflow.examspeaking.api.model.RubricRef;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Mô phỏng 2 giám khảo: gộp nhiều pass độc lập. Điểm tiêu chí = trung bình; band hiển thị = band trung vị
 * (với số pass chẵn lấy band thấp hơn ở giữa → thiên nghiêm, đúng chủ trương chống hào phóng).
 * Khoảng tin cậy = [min, max] tổng của các pass.
 */
@Component
public class ScoreAggregator {

    /** Tiêu chí có band lệch > 1 bậc giữa các pass → cần pass trọng tài. */
    public List<String> divergentCriteria(RubricDefinition rubric, List<Ergebnisbogen> passes) {
        List<String> out = new ArrayList<>();
        Map<String, List<Ergebnisbogen.CriterionResult>> byKey = groupByKey(passes);
        byKey.forEach((key, results) -> {
            int min = Integer.MAX_VALUE;
            int max = Integer.MIN_VALUE;
            for (Ergebnisbogen.CriterionResult r : results) {
                if (!r.scored() || r.band() == null) {
                    continue;
                }
                int idx = BandScales.index(rubric.scale(), r.band());
                min = Math.min(min, idx);
                max = Math.max(max, idx);
            }
            if (min != Integer.MAX_VALUE && max - min > 1) {
                out.add(key);
            }
        });
        return out;
    }

    public Ergebnisbogen combine(RubricRef ref, RubricDefinition rubric, List<Ergebnisbogen> passes) {
        if (passes.size() == 1) {
            return passes.get(0);
        }
        Ergebnisbogen first = passes.get(0);
        List<Ergebnisbogen.PartResult> parts = new ArrayList<>();
        for (Ergebnisbogen.PartResult p0 : first.parts()) {
            List<Ergebnisbogen.CriterionResult> merged = new ArrayList<>();
            for (int i = 0; i < p0.criteria().size(); i++) {
                final int idx = i;
                List<Ergebnisbogen.CriterionResult> across = passes.stream()
                        .map(p -> p.parts().stream().filter(pp -> pp.teilNo() == p0.teilNo()).findFirst().orElse(null))
                        .filter(Objects::nonNull)
                        .map(pp -> pp.criteria().get(idx))
                        .toList();
                merged.add(mergeCriterion(rubric, across));
            }
            long zeroedVotes = passes.stream()
                    .map(p -> p.parts().stream().filter(pp -> pp.teilNo() == p0.teilNo()).findFirst().orElse(null))
                    .filter(Objects::nonNull).filter(Ergebnisbogen.PartResult::zeroed).count();
            boolean zeroed = zeroedVotes * 2 >= passes.size();
            if (zeroed) {
                merged = merged.stream().map(c -> new Ergebnisbogen.CriterionResult(c.code(), c.label(), c.band(), 0, c.max(),
                        c.scored(), c.confidence(), c.evidence())).toList();
            }
            double points = merged.stream().filter(Ergebnisbogen.CriterionResult::scored).mapToDouble(Ergebnisbogen.CriterionResult::points).sum();
            double max = merged.stream().filter(Ergebnisbogen.CriterionResult::scored).mapToDouble(Ergebnisbogen.CriterionResult::max).sum();
            parts.add(new Ergebnisbogen.PartResult(p0.teilNo(), merged, RubricScorer.round2(points), RubricScorer.round2(max), zeroed));
        }
        List<Ergebnisbogen.CriterionResult> global = new ArrayList<>();
        for (int i = 0; i < first.global().size(); i++) {
            final int idx = i;
            global.add(mergeCriterion(rubric, passes.stream().map(p -> p.global().get(idx)).toList()));
        }
        List<Ergebnisbogen.ErrorItem> errors = dedupeErrors(passes);
        List<String> notes = new ArrayList<>();
        passes.stream().flatMap(p -> p.notes().stream()).distinct().forEach(notes::add);
        double low = passes.stream().mapToDouble(Ergebnisbogen::total).min().orElse(0);
        double high = passes.stream().mapToDouble(Ergebnisbogen::total).max().orElse(0);
        return RubricScorer.Totals.assemble(ref, rubric, parts, global, errors, notes, passes.size(), low, high);
    }

    private Ergebnisbogen.CriterionResult mergeCriterion(RubricDefinition rubric, List<Ergebnisbogen.CriterionResult> across) {
        List<Ergebnisbogen.CriterionResult> scored = across.stream().filter(c -> c.scored() && c.band() != null).toList();
        Ergebnisbogen.CriterionResult ref = across.get(0);
        if (scored.isEmpty()) {
            return ref;
        }
        double avgPoints = scored.stream().mapToDouble(Ergebnisbogen.CriterionResult::points).average().orElse(0);
        List<Integer> idx = new ArrayList<>(scored.stream().map(c -> BandScales.index(rubric.scale(), c.band())).sorted().toList());
        // trung vị; chẵn → phần tử giữa có index lớn hơn (band thấp hơn) = thiên nghiêm
        int median = idx.get(idx.size() / 2);
        String band = BandScales.bands(rubric.scale()).get(median);
        List<String> evidence = new ArrayList<>();
        scored.forEach(c -> c.evidence().stream().filter(e -> !evidence.contains(e)).limit(2).forEach(evidence::add));
        String confidence = scored.stream().map(Ergebnisbogen.CriterionResult::confidence).filter(Objects::nonNull)
                .min(String::compareTo).orElse(ref.confidence());
        return new Ergebnisbogen.CriterionResult(ref.code(), ref.label(), band, RubricScorer.round2(avgPoints), ref.max(),
                true, confidence, evidence);
    }

    private static Map<String, List<Ergebnisbogen.CriterionResult>> groupByKey(List<Ergebnisbogen> passes) {
        Map<String, List<Ergebnisbogen.CriterionResult>> byKey = new LinkedHashMap<>();
        for (Ergebnisbogen e : passes) {
            for (Ergebnisbogen.PartResult p : e.parts()) {
                for (Ergebnisbogen.CriterionResult c : p.criteria()) {
                    byKey.computeIfAbsent("T" + p.teilNo() + ":" + c.code(), k -> new ArrayList<>()).add(c);
                }
            }
            for (Ergebnisbogen.CriterionResult c : e.global()) {
                byKey.computeIfAbsent("G:" + c.code(), k -> new ArrayList<>()).add(c);
            }
        }
        return byKey;
    }

    private static List<Ergebnisbogen.ErrorItem> dedupeErrors(List<Ergebnisbogen> passes) {
        Map<String, Ergebnisbogen.ErrorItem> byOriginal = new LinkedHashMap<>();
        for (Ergebnisbogen e : passes) {
            for (Ergebnisbogen.ErrorItem err : e.errors()) {
                String key = (err.original() == null ? "" : err.original().trim().toLowerCase()) + "|" + err.teilNo();
                byOriginal.putIfAbsent(key, err);
            }
        }
        return new ArrayList<>(byOriginal.values());
    }
}
