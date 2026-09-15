package com.deutschflow.examspeaking.api.model;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Phiếu kết quả mô phỏng phiếu chấm của hệ. Mọi con số đều có nguồn gốc (evidence) + nhãn tin cậy;
 * tổng trả dạng khoảng [totalLow, totalHigh] quanh tâm {@code total} (kế hoạch 2.4 — "không fake độ chính xác").
 *
 * <p>N1c-3: chuỗi backend sinh ra (ghi chú, luật đỗ, dòng bằng chứng đo lường) đi kèm bản structured
 * {@link Msg} (code + params) để FE dịch theo locale. Chuỗi tiếng Việt cũ giữ nguyên làm fallback
 * cho phiếu đã lưu trước đây.</p>
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
        int passes,
        Msg passRuleMsg,
        List<Msg> noteMsgs,
        /**
         * F-17: khoảng [totalLow, totalHigh] vắt qua ngưỡng đỗ — {@code passed} vẫn chốt theo điểm tâm
         * (thống kê/golden cần một kết luận), nhưng UI phải hiện "sát ngưỡng" thay vì đỗ/trượt dứt khoát.
         */
        boolean borderline
) {
    /** Tương thích: không có cờ borderline (mặc định false). */
    public Ergebnisbogen(RubricRef rubricRef, List<PartResult> parts, List<CriterionResult> global,
                         double total, double totalLow, double totalHigh, double maxPoints, double officialMax,
                         Boolean passed, String passRule, List<ErrorItem> errors, List<String> notes, int passes,
                         Msg passRuleMsg, List<Msg> noteMsgs) {
        this(rubricRef, parts, global, total, totalLow, totalHigh, maxPoints, officialMax, passed, passRule,
                errors, notes, passes, passRuleMsg, noteMsgs, false);
    }

    public Ergebnisbogen {
        parts = parts == null ? List.of() : List.copyOf(parts);
        global = global == null ? List.of() : List.copyOf(global);
        errors = errors == null ? List.of() : List.copyOf(errors);
        notes = notes == null ? List.of() : List.copyOf(notes);
        noteMsgs = noteMsgs == null ? List.of() : List.copyOf(noteMsgs);
    }

    /** Tương thích cũ (test/phiếu trước N1c-3): không có bản structured. */
    public Ergebnisbogen(RubricRef rubricRef, List<PartResult> parts, List<CriterionResult> global,
                         double total, double totalLow, double totalHigh, double maxPoints, double officialMax,
                         Boolean passed, String passRule, List<ErrorItem> errors, List<String> notes, int passes) {
        this(rubricRef, parts, global, total, totalLow, totalHigh, maxPoints, officialMax, passed, passRule,
                errors, notes, passes, null, List.of());
    }

    /**
     * Thông điệp structured cho FE dịch: {@code code} ổn định (khoá i18n), {@code params} là giá trị chèn
     * vào bản dịch. Số thập phân đã được backend làm tròn/format sẵn thành chuỗi để mọi locale hiển thị
     * giống nhau.
     */
    public record Msg(String code, Map<String, Object> params) {
        public Msg {
            params = params == null ? Map.of() : Map.copyOf(params);
        }

        public static Msg of(String code) {
            return new Msg(code, Map.of());
        }

        /** Tạo nhanh với cặp key/value xen kẽ, giữ thứ tự khai báo. */
        public static Msg of(String code, Object... kv) {
            Map<String, Object> params = new LinkedHashMap<>();
            for (int i = 0; i + 1 < kv.length; i += 2) {
                params.put(String.valueOf(kv[i]), kv[i + 1]);
            }
            return new Msg(code, params);
        }
    }

    public record PartResult(int teilNo, List<CriterionResult> criteria, double points, double max, boolean zeroed,
                             String comment) {
        /** Tương thích cũ: không comment. */
        public PartResult(int teilNo, List<CriterionResult> criteria, double points, double max, boolean zeroed) {
            this(teilNo, criteria, points, max, zeroed, null);
        }

        public PartResult {
            criteria = criteria == null ? List.of() : List.copyOf(criteria);
        }
    }

    /**
     * {@code band}: A–E / A–D / VOLL|HALB|NULL. {@code scored=false} khi không có tín hiệu (vd Aussprache
     * không có audio) → loại khỏi cả tử lẫn mẫu, ghi chú rõ. {@code evidence} chứa trích dẫn tự do của LLM;
     * {@code evidenceMsgs} chứa dòng đo lường/lý do do code sinh (FE dịch).
     */
    public record CriterionResult(
            String code,
            String label,
            String band,
            double points,
            double max,
            boolean scored,
            String confidence,
            List<String> evidence,
            List<Msg> evidenceMsgs
    ) {
        public CriterionResult {
            evidence = evidence == null ? List.of() : List.copyOf(evidence);
            evidenceMsgs = evidenceMsgs == null ? List.of() : List.copyOf(evidenceMsgs);
        }

        /** Tương thích cũ: không có dòng structured. */
        public CriterionResult(String code, String label, String band, double points, double max, boolean scored,
                               String confidence, List<String> evidence) {
            this(code, label, band, points, max, scored, confidence, evidence, List.of());
        }
    }

    public record ErrorItem(String code, String original, String correction, String severity, int teilNo) {}
}
