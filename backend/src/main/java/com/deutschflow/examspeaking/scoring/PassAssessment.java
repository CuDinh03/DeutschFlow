package com.deutschflow.examspeaking.scoring;

import com.deutschflow.examspeaking.api.model.Ergebnisbogen;

import java.util.List;
import java.util.Map;

/**
 * Kết quả một lượt chấm ("một giám khảo"): band/trạng thái + bằng chứng cho từng tiêu chí/nhiệm vụ.
 * KHÔNG chứa điểm — điểm do {@link RubricScorer} tính từ rubric.
 */
public record PassAssessment(
        Map<Integer, PartAssessment> parts,
        Map<String, CriterionAssessment> global,
        List<Ergebnisbogen.ErrorItem> errors,
        List<String> notes
) {
    public PassAssessment {
        parts = parts == null ? Map.of() : Map.copyOf(parts);
        global = global == null ? Map.of() : Map.copyOf(global);
        errors = errors == null ? List.of() : List.copyOf(errors);
        notes = notes == null ? List.of() : List.copyOf(notes);
    }

    public record PartAssessment(int teilNo, Map<String, CriterionAssessment> items, Map<String, CriterionAssessment> criteria) {
        public PartAssessment {
            items = items == null ? Map.of() : Map.copyOf(items);
            criteria = criteria == null ? Map.of() : Map.copyOf(criteria);
        }
    }

    /** {@code band} đã chuẩn hóa theo thang; {@code scored=false} = không có tín hiệu. */
    public record CriterionAssessment(String band, boolean scored, String confidence, List<String> evidence) {
        public CriterionAssessment {
            evidence = evidence == null ? List.of() : List.copyOf(evidence);
        }

        public static CriterionAssessment unscored(String why) {
            return new CriterionAssessment(null, false, "none", List.of(why));
        }
    }
}
