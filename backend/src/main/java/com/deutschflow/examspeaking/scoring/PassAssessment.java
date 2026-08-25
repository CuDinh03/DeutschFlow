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
        List<String> notes,
        List<Ergebnisbogen.Msg> noteMsgs
) {
    public PassAssessment {
        parts = parts == null ? Map.of() : Map.copyOf(parts);
        global = global == null ? Map.of() : Map.copyOf(global);
        errors = errors == null ? List.of() : List.copyOf(errors);
        notes = notes == null ? List.of() : List.copyOf(notes);
        noteMsgs = noteMsgs == null ? List.of() : List.copyOf(noteMsgs);
    }

    /** Tương thích test/cũ: không có bản structured của ghi chú. */
    public PassAssessment(Map<Integer, PartAssessment> parts, Map<String, CriterionAssessment> global,
                          List<Ergebnisbogen.ErrorItem> errors, List<String> notes) {
        this(parts, global, errors, notes, List.of());
    }

    /**
     * {@code silent} = thí sinh KHÔNG nói gì trong Teil (khác "LLM không trả kết quả"): Teil vẫn tính
     * trong tổng với 0 điểm (N1c-1). {@code comment} = 2 câu nhận xét của "giám khảo" cho Teil (N1c-2).
     */
    public record PartAssessment(int teilNo, Map<String, CriterionAssessment> items,
                                 Map<String, CriterionAssessment> criteria, boolean silent, String comment) {
        public PartAssessment {
            items = items == null ? Map.of() : Map.copyOf(items);
            criteria = criteria == null ? Map.of() : Map.copyOf(criteria);
        }

        /** Tương thích test/cũ: không silent, không comment. */
        public PartAssessment(int teilNo, Map<String, CriterionAssessment> items, Map<String, CriterionAssessment> criteria) {
            this(teilNo, items, criteria, false, null);
        }
    }

    /**
     * {@code band} đã chuẩn hóa theo thang; {@code scored=false} = không có tín hiệu.
     * {@code evidence} = trích dẫn tự do của LLM; {@code evidenceMsgs} = dòng đo lường/lý do code sinh (N1c-3).
     */
    public record CriterionAssessment(String band, boolean scored, String confidence, List<String> evidence,
                                      List<Ergebnisbogen.Msg> evidenceMsgs) {
        public CriterionAssessment {
            evidence = evidence == null ? List.of() : List.copyOf(evidence);
            evidenceMsgs = evidenceMsgs == null ? List.of() : List.copyOf(evidenceMsgs);
        }

        /** Tương thích test/cũ: không có dòng structured. */
        public CriterionAssessment(String band, boolean scored, String confidence, List<String> evidence) {
            this(band, scored, confidence, evidence, List.of());
        }

        public static CriterionAssessment unscored(String why) {
            return new CriterionAssessment(null, false, "none", List.of(why));
        }

        /** unscored với lý do structured — chuỗi VI không còn cần thiết cho phiếu mới. */
        public static CriterionAssessment unscored(Ergebnisbogen.Msg why) {
            return new CriterionAssessment(null, false, "none", List.of(), List.of(why));
        }
    }
}
