package com.deutschflow.examspeaking.api.model;

import java.util.List;
import java.util.Map;

/**
 * Bộ quy điểm của một hệ (rubric_json). CODE quyết điểm từ đây — LLM chỉ trả band/trạng thái + bằng chứng.
 *
 * <ul>
 *   <li>{@code scale} A_E (Goethe), A_D (telc), VHN (volle/halbe/null theo nhiệm vụ — A1 hai hệ, telc A2).</li>
 *   <li>{@code bandFractions} dùng cho A_E khi tiêu chí không khai {@code bandPoints} riêng.</li>
 *   <li>{@code rawMultiplier} (A1: ×1,66) quy điểm thô về thang công bố; làm tròn half-up.</li>
 *   <li>{@code speakingOnlyMin}: ngưỡng nói riêng (Goethe A2 15/25, telc B1/B2 45/75).</li>
 * </ul>
 */
public record RubricDefinition(
        ExamProvider scheme,
        BandScale scale,
        Map<String, Double> bandFractions,
        double maxTotal,
        Double passMin,
        Double speakingOnlyMin,
        Double rawMax,
        Double rawMultiplier,
        boolean zeroPartIfErfuellungLowest,
        boolean aStarEqualsA,
        List<RubricPart> parts,
        List<RubricCriterion> global,
        String approximation,
        String notes
) {
    public enum BandScale { A_E, A_D, VHN }

    public record RubricPart(int teilNo, List<RubricCriterion> criteria, List<RubricItem> items) {
        public RubricPart {
            criteria = criteria == null ? List.of() : List.copyOf(criteria);
            items = items == null ? List.of() : List.copyOf(items);
        }
    }

    /** Tiêu chí chấm theo band (A–E / A–D). {@code bandPoints} tùy chọn: bảng điểm tuyệt đối theo band. */
    public record RubricCriterion(String code, String label, double max, Map<String, Double> bandPoints) {
        public RubricCriterion {
            bandPoints = bandPoints == null ? Map.of() : Map.copyOf(bandPoints);
        }
    }

    /** Nhiệm vụ chấm volle/halbe/null (A1). */
    public record RubricItem(String code, String label, double max) {}

    public RubricDefinition {
        bandFractions = bandFractions == null ? Map.of() : Map.copyOf(bandFractions);
        parts = parts == null ? List.of() : List.copyOf(parts);
        global = global == null ? List.of() : List.copyOf(global);
    }

    /** Điểm tối đa chính thức của thang (maxTotal) — dùng cho đỗ/trượt và hiển thị. */
    public double officialMax() {
        return maxTotal;
    }

    public String lowestBand() {
        return switch (scale) {
            case A_E -> "E";
            case A_D -> "D";
            case VHN -> "NULL";
        };
    }
}
