package com.deutschflow.examspeaking.api.model;

import java.util.List;

/**
 * Phiếu kết quả mô phỏng phiếu chấm của hệ. Mọi con số đều có nguồn gốc (evidence) + nhãn tin cậy;
 * tổng trả dạng khoảng [totalLow, totalHigh] quanh tâm {@code total} (kế hoạch 2.4 — "không fake độ chính xác").
 */
public record Ergebnisbogen(
        RubricRef rubricRef,
        List<PartResult> parts,
        List<CriterionResult> global,
        double total,
        double totalLow,
        double totalHigh,
        double maxPoints,
        double officialMax,
        Boolean passed,
        String passRule,
        List<ErrorItem> errors,
        List<String> notes,
        int passes
) {
    public Ergebnisbogen {
        parts = parts == null ? List.of() : List.copyOf(parts);
        global = global == null ? List.of() : List.copyOf(global);
        errors = errors == null ? List.of() : List.copyOf(errors);
        notes = notes == null ? List.of() : List.copyOf(notes);
    }

    public record PartResult(int teilNo, List<CriterionResult> criteria, double points, double max, boolean zeroed) {
        public PartResult {
            criteria = criteria == null ? List.of() : List.copyOf(criteria);
        }
    }

    /**
     * {@code band}: A–E / A–D / VOLL|HALB|NULL. {@code scored=false} khi không có tín hiệu (vd Aussprache
     * không có audio) → loại khỏi cả tử lẫn mẫu, ghi chú rõ.
     */
    public record CriterionResult(
            String code,
            String label,
            String band,
            double points,
            double max,
            boolean scored,
            String confidence,
            List<String> evidence
    ) {
        public CriterionResult {
            evidence = evidence == null ? List.of() : List.copyOf(evidence);
        }
    }

    public record ErrorItem(String code, String original, String correction, String severity, int teilNo) {}
}
