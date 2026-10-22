package com.deutschflow.grammar.service;

import com.deutschflow.grammar.dto.ExamBudgetDto;
import com.deutschflow.grammar.dto.ExamBudgetDto.GradeTarget;
import com.deutschflow.grammar.dto.ExamBudgetDto.SectionShare;
import com.deutschflow.grammar.dto.ExamBudgetDto.TeilLoss;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Tính "ngân sách điểm" cho màn kết quả đề thi thử nhiều cổng (LT1 — kế hoạch luyện thi 21/10/2026).
 *
 * <p>Ba câu trả lời cho người học: (1) mất điểm ở Teil nào nhiều nhất — xếp theo <b>điểm</b> đã mất
 * chứ không theo số câu sai, vì telc cho 5 điểm một câu ở Hören Teil 1 nhưng 1,5 ở Sprachbausteine;
 * (2) muốn đạt xếp loại X thì được mất tối đa bao nhiêu điểm; (3) một cách chia số điểm đó theo phần.
 *
 * <p>Hàm thuần: chỉ đọc cấu trúc đề, đáp án đã nộp, điểm đã chấm và các cổng đã tính lại — không
 * gọi DB, không gọi AI.
 */
@Service
@Slf4j
public class ExamBudgetService {

    /** Phần chấm theo câu: điểm theo Teil tính lại được từ đáp án + đáp án đúng. */
    private static final Set<String> OBJECTIVE_SECTIONS = Set.of("LESEN", "SPRACHBAUSTEINE", "HOEREN");

    /** Cổng lấy điểm ngoài đề giấy → tên phần hiển thị (telc: cổng {@code oral} = phần Nói). */
    private static final Map<String, String> EXTERNAL_GATE_SECTION = Map.of("oral", "SPRECHEN");

    /**
     * @param structure  {@code sections_json} của đề
     * @param answers    đáp án đã nộp ({@code {questionId: answer}})
     * @param detailed   {@code detailed_scores_json} của bài làm
     * @param gates      các cổng vừa tính lại (có điểm Nói mới nhất)
     * @param cefrLevel  bậc của đề — cùng {@code format} tra bảng xếp loại
     * @return {@code null} với đề không có {@code pass_rule} (Goethe) — màn kết quả giữ nguyên
     */
    public ExamBudgetDto compute(Map<String, Object> structure, Map<String, String> answers,
                                 Map<String, Object> detailed, List<ExamScoringService.Gate> gates,
                                 String cefrLevel) {
        if (!(structure.get("pass_rule") instanceof Map<?, ?>)) return null;

        List<TeilLoss> rows = new ArrayList<>();
        for (Map<String, Object> section : maps(structure.get("sections"))) {
            String name = String.valueOf(section.get("name"));
            Map<String, Object> scored = detailed.get(name) instanceof Map<?, ?> m ? cast(m) : Map.of();
            boolean completed = ExamScoringService.STATUS_COMPLETED.equals(String.valueOf(scored.get("status")));
            if (OBJECTIVE_SECTIONS.contains(name)) {
                rows.addAll(objectiveTeile(name, section, answers, !completed));
            } else if (scored.containsKey("max") || section.containsKey("max_points")) {
                double max = number(scored.get("max"), number(section.get("max_points"), 0));
                rows.add(completed
                        ? lossRow(name, null, max, number(scored.get("total"), 0), null, null, null)
                        : pendingRow(name, null, max, null, null));
            }
        }
        for (ExamScoringService.Gate gate : gates) {
            String section = EXTERNAL_GATE_SECTION.get(gate.id());
            if (section == null) continue;
            rows.add(ExamScoringService.GATE_PENDING.equals(gate.status())
                    ? pendingRow(section, null, gate.max(), null, null)
                    : lossRow(section, null, gate.max(), gate.raw(), null, null, null));
        }

        double totalMax = rows.stream().mapToDouble(TeilLoss::max).sum();
        double earned = rows.stream().filter(r -> !r.pending()).mapToDouble(TeilLoss::earned).sum();
        double lost = rows.stream().filter(r -> !r.pending()).mapToDouble(TeilLoss::lost).sum();
        boolean pending = rows.stream().anyMatch(TeilLoss::pending);

        List<TeilLoss> sorted = rows.stream()
                .sorted(Comparator.comparing(TeilLoss::pending)
                        .thenComparing(r -> r.pending() ? 0 : -r.lost())
                        .thenComparing(r -> -r.max()))
                .toList();

        return new ExamBudgetDto(totalMax, round2(earned), round2(lost), pending, sorted,
                targets(String.valueOf(structure.get("format")), cefrLevel, totalMax, lost, rows));
    }

    /** Một dòng cho mỗi Teil của phần chấm theo câu. Trọng số câu như {@link ExamScoringService#scoreObjectiveSection}. */
    private static List<TeilLoss> objectiveTeile(String name, Map<String, Object> section,
                                                 Map<String, String> answers, boolean pending) {
        List<Map<String, Object>> teile = maps(section.get("teile"));
        int totalItems = 0;
        for (Map<String, Object> teil : teile) totalItems += maps(teil.get("items")).size();
        // Đề không khai trọng số (Goethe-kiểu) ⇒ mỗi câu nặng như nhau trên max_points của phần.
        double fallbackWeight = totalItems > 0 ? number(section.get("max_points"), 25) / totalItems : 0;

        List<TeilLoss> out = new ArrayList<>();
        int index = 0;
        for (Map<String, Object> teil : teile) {
            index++;
            Integer teilNo = teil.get("teil") instanceof Number n ? n.intValue() : index;
            Double teilWeight = positive(teil.get("point_per_item"));
            double max = 0;
            double earned = 0;
            int items = 0;
            int correct = 0;
            boolean uniform = true;
            Double firstWeight = null;
            for (Map<String, Object> item : maps(teil.get("items"))) {
                Object id = item.get("id");
                Object expected = item.get("correct");
                if (id == null || expected == null) continue;
                Double itemWeight = positive(item.get("points"));
                double weight = itemWeight != null ? itemWeight : teilWeight != null ? teilWeight : fallbackWeight;
                if (firstWeight == null) firstWeight = weight;
                else if (Math.abs(firstWeight - weight) > 1e-9) uniform = false;
                items++;
                max += weight;
                String given = answers.get(id.toString());
                if (given != null && given.trim().equalsIgnoreCase(expected.toString().trim())) {
                    correct++;
                    earned += weight;
                }
            }
            if (items == 0) continue;
            Double perItem = uniform ? firstWeight : null;
            out.add(pending
                    ? pendingRow(name, teilNo, max, perItem, items)
                    : lossRow(name, teilNo, max, earned, perItem, items, correct));
        }
        return out;
    }

    private static List<GradeTarget> targets(String format, String cefrLevel, double totalMax, double lost,
                                             List<TeilLoss> rows) {
        ExamGradeBands.Scale scale = ExamGradeBands.find(format, cefrLevel);
        if (scale == null) return List.of();
        if (Math.abs(scale.totalMax() - totalMax) > 0.01) {
            // Đề thiếu phần (vd. seed lỗi) thì thang xếp loại không còn khớp — không bịa mục tiêu.
            log.warn("[ExamBudget] {} {}: tổng điểm đề {} ≠ thang xếp loại {} — bỏ mục tiêu xếp loại",
                    format, cefrLevel, totalMax, scale.totalMax());
            return List.of();
        }
        Map<String, Double> sectionMax = new LinkedHashMap<>();
        for (TeilLoss r : rows) sectionMax.merge(r.section(), r.max(), Double::sum);

        List<GradeTarget> out = new ArrayList<>();
        for (ExamGradeBands.Band band : scale.bands()) {
            double maxLoss = totalMax - band.minPoints();
            List<SectionShare> example = new ArrayList<>();
            sectionMax.forEach((section, max) ->
                    example.add(new SectionShare(section, max, floorHalf(maxLoss * max / totalMax))));
            out.add(new GradeTarget(band.grade(), band.minPoints(), maxLoss, round2(maxLoss - lost), example));
        }
        return out;
    }

    private static TeilLoss lossRow(String section, Integer teil, double max, double earned,
                                    Double perItem, Integer items, Integer correct) {
        double e = round2(Math.min(earned, max));
        return new TeilLoss(section, teil, round2(max), e, round2(max - e), perItem, items, correct, false);
    }

    private static TeilLoss pendingRow(String section, Integer teil, double max, Double perItem, Integer items) {
        return new TeilLoss(section, teil, round2(max), null, null, perItem, items, null, true);
    }

    // ─── tiện ích ────────────────────────────────────────────────────────────

    private static double floorHalf(double v) {
        return Math.floor(v * 2) / 2;
    }

    private static double round2(double v) {
        return Math.round(v * 100) / 100.0;
    }

    private static Double positive(Object value) {
        double v = number(value, 0);
        return v > 0 ? v : null;
    }

    private static double number(Object value, double fallback) {
        if (value instanceof Number n) return n.doubleValue();
        if (value instanceof String s) {
            try {
                return Double.parseDouble(s.trim());
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }

    /** Danh sách object JSON — chấp nhận mảng lẫn map (như {@code teileList} của bộ chấm). */
    private static List<Map<String, Object>> maps(Object raw) {
        Collection<?> values = raw instanceof List<?> list ? list
                : raw instanceof Map<?, ?> map ? map.values() : List.of();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object v : values) {
            if (v instanceof Map<?, ?> m) out.add(cast(m));
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> cast(Map<?, ?> m) {
        return (Map<String, Object>) m;
    }
}
