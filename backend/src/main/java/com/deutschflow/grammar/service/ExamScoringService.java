package com.deutschflow.grammar.service;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Chấm bài thi thử 4 kỹ năng (Goethe/telc) — mỗi phần quy về thang điểm của chính đề
 * ({@code max_points} trong {@code sections_json}, mặc định 25).
 *
 * <p>Ba luật chấm, sửa ngày 07/09/2026 (gap AC-EXAM-05):
 * <ul>
 *   <li><b>Đọc/Nghe:</b> tỉ lệ câu đúng trên tổng số câu CÓ TRONG ĐỀ. Trước đây mẫu số bị đóng
 *       cứng 25 nên đề 15 câu có trả lời đúng hết cũng chỉ được 15/25 = 60%.</li>
 *   <li><b>Viết:</b> mỗi Teil là một nhiệm vụ — điền form chấm tự động theo số ô đã điền, bài viết
 *       chấm bằng AI. Bài viết đọc đúng khoá trình chạy gửi lên ({@code email_<teil>}); khoá cũ
 *       {@code email_section} không bên nào ghi nên phần Viết luôn 0 điểm.</li>
 *   <li><b>Nói:</b> cần transcript; không có thì phần này là "chờ chấm" chứ không phải 0 điểm.</li>
 * </ul>
 *
 * <p>Phần đang chờ chấm KHÔNG vào tử số lẫn mẫu số của tổng điểm ({@link #summarize}) — học viên
 * không bị trừ điểm vì hạ tầng AI hỏng, và tổng vẫn là thang 100 để so với ngưỡng đỗ của đề.
 */
@Service
public class ExamScoringService {

    /** Phần đã chấm xong — vào cả tử số lẫn mẫu số của tổng điểm. */
    public static final String STATUS_COMPLETED = "COMPLETED";
    /** Phần chưa chấm được (thiếu dữ liệu hoặc AI hỏng) — bị loại khỏi tổng điểm. */
    public static final String STATUS_PENDING = "PENDING_AI_EVALUATION";

    private static final List<String> SECTION_ORDER = List.of("LESEN", "HOEREN", "SCHREIBEN", "SPRECHEN");
    private static final int DEFAULT_SECTION_MAX = 25;
    private static final int DEFAULT_PASS_PERCENT = 60;
    private static final int WEAK_AREA_PERCENT = 60;
    /** Phần Viết có cả form lẫn bài viết: form giữ tỉ trọng 40% (đúng thang 10/25 dùng từ trước). */
    private static final double FORM_SHARE = 0.4;
    /** Thang điểm thô của {@link AiExamEvaluatorService#evaluateSchreibenEmail}. */
    private static final double AI_EMAIL_MAX = 15;
    /** Thang điểm thô của {@link AiExamEvaluatorService#evaluateSprechen}. */
    private static final double AI_SPRECHEN_MAX = 18;

    private final AiExamEvaluatorService aiEvaluator;

    public ExamScoringService(AiExamEvaluatorService aiEvaluator) {
        this.aiEvaluator = aiEvaluator;
    }

    // ─── Đọc / Nghe ──────────────────────────────────────────────────────────

    /**
     * Chấm một phần khách quan (LESEN/HOEREN): mỗi câu đúng 1 điểm thô, so khớp không phân biệt
     * hoa thường, rồi quy về thang điểm của phần.
     */
    public Map<String, Object> scoreObjectiveSection(Map<String, Object> answers, Map<String, Object> section) {
        int max = sectionMax(section);
        int correct = 0;
        int itemCount = 0;

        for (Map<String, Object> teil : teileList(section)) {
            if (!(teil.get("items") instanceof List<?> items)) continue;
            for (Object itemObj : items) {
                if (!(itemObj instanceof Map<?, ?> raw)) continue;
                Map<String, Object> item = castMap(raw);
                Object id = item.get("id");
                Object expected = item.get("correct");
                if (id == null || expected == null) continue;
                itemCount++;
                Object given = answers.get(id.toString());
                if (given != null && given.toString().trim().equalsIgnoreCase(expected.toString().trim())) {
                    correct++;
                }
            }
        }

        int points = itemCount > 0 ? (int) Math.round(max * (double) correct / itemCount) : 0;
        Map<String, Object> out = scoredSection(points, max, STATUS_COMPLETED);
        out.put("correct_items", correct);
        out.put("total_items", itemCount);
        return out;
    }

    // ─── Viết ────────────────────────────────────────────────────────────────

    /**
     * Chấm phần Viết. Mỗi Teil là một nhiệm vụ: có {@code form_fields} thì chấm tự động theo số ô
     * đã điền, còn lại là bài viết chấm bằng AI. Bỏ trống = 0 điểm (học viên không làm); AI hỏng =
     * chờ chấm (nhiệm vụ đó rời khỏi mẫu số, không kéo điểm học viên xuống).
     */
    public Map<String, Object> scoreSchreibenSection(long userId, Map<String, Object> answers,
                                                     Map<String, Object> section, String cefrLevel) {
        int max = sectionMax(section);
        List<Map<String, Object>> forms = new ArrayList<>();
        List<Map<String, Object>> writings = new ArrayList<>();
        for (Map<String, Object> teil : teileList(section)) {
            if (teil.get("form_fields") instanceof List<?> fields && !fields.isEmpty()) {
                forms.add(teil);
            } else {
                writings.add(teil);
            }
        }
        if (forms.isEmpty() && writings.isEmpty()) {
            return scoredSection(0, max, STATUS_PENDING);
        }

        double formPool = forms.isEmpty() ? 0 : (writings.isEmpty() ? max : max * FORM_SHARE);
        double writePool = max - formPool;

        List<Map<String, Object>> tasks = new ArrayList<>();
        Map<String, Object> firstAiEval = null;
        double earned = 0;
        double scorable = 0;

        for (Map<String, Object> teil : forms) {
            double weight = formPool / forms.size();
            double ratio = formRatio(answers, teil);
            earned += weight * ratio;
            scorable += weight;
            tasks.add(taskDetail(teil, "FORM", weight, weight * ratio, STATUS_COMPLETED));
        }

        for (Map<String, Object> teil : writings) {
            double weight = writePool / writings.size();
            String text = writingAnswer(answers, teil);
            if (text.isBlank()) {
                scorable += weight;
                tasks.add(taskDetail(teil, "WRITING", weight, 0, STATUS_COMPLETED));
                continue;
            }
            Map<String, Object> ai = aiEvaluator.evaluateSchreibenEmail(
                    userId, text, taskPrompt(teil), examLevel(section, cefrLevel));
            if (firstAiEval == null) firstAiEval = ai;
            if (isPending(ai)) {
                tasks.add(taskDetail(teil, "WRITING", weight, 0, STATUS_PENDING));
                continue;
            }
            double ratio = clamp01(numberOf(ai.get("total")) / AI_EMAIL_MAX);
            earned += weight * ratio;
            scorable += weight;
            tasks.add(taskDetail(teil, "WRITING", weight, weight * ratio, STATUS_COMPLETED));
        }

        boolean allPending = scorable <= 0;
        Map<String, Object> out = scoredSection(
                allPending ? 0 : (int) Math.round(earned),
                allPending ? max : (int) Math.round(scorable),
                allPending ? STATUS_PENDING : STATUS_COMPLETED);
        out.put("tasks", tasks);
        // Khoá cũ: màn nhận xét AI phần Viết (ExamFeedback) đọc `teil2_email`.
        if (firstAiEval != null) out.put("teil2_email", firstAiEval);
        return out;
    }

    /** Tỉ lệ ô đã điền của một Teil dạng form; khoá câu trả lời là {@code form_<chỉ số ô>}. */
    private double formRatio(Map<String, Object> answers, Map<String, Object> teil) {
        if (!(teil.get("form_fields") instanceof List<?> fields) || fields.isEmpty()) return 0;
        int filled = 0;
        for (int i = 0; i < fields.size(); i++) {
            Object value = answers.get("form_" + i);
            if (value != null && !value.toString().isBlank()) filled++;
        }
        return (double) filled / fields.size();
    }

    /**
     * Bài viết của một Teil. Trình chạy web gửi khoá {@code email_<teil>}; giữ thêm
     * {@code schreiben_<teil>} và khoá cũ {@code email_section} cho các bản ghi lịch sử.
     */
    private String writingAnswer(Map<String, Object> answers, Map<String, Object> teil) {
        Object teilNo = teil.get("teil");
        List<String> keys = new ArrayList<>();
        if (teilNo != null) {
            keys.add("email_" + teilNo);
            keys.add("schreiben_" + teilNo);
        }
        keys.add("email_section");
        for (String key : keys) {
            Object value = answers.get(key);
            if (value != null && !value.toString().isBlank()) return value.toString();
        }
        return "";
    }

    /**
     * Đề bài đầy đủ gửi cho AI: câu lệnh + tình huống/chủ đề + CÁC Ý BẮT BUỘC.
     *
     * <p>Trước 07/09/2026 hàm này trả về trường đầu tiên tìm thấy, mà {@code instruction_vi} luôn
     * đứng trước — nên AI chỉ nhận một dòng tiếng Việt kiểu "Viết bài đăng diễn đàn ~80 từ", còn
     * chủ đề ({@code input_email}/{@code prompt}) và các ý bắt buộc ({@code writing_points}) không
     * bao giờ tới nơi. Tiêu chí {@code aufgabenerfuellung} đúng nghĩa là "có nêu đủ các ý yêu cầu
     * không", nên nó chấm mà không có gì để đối chiếu.
     */
    private String taskPrompt(Map<String, Object> teil) {
        StringBuilder task = new StringBuilder();
        // Câu lệnh: ưu tiên tiếng Đức vì phần còn lại của prompt là Đức/Anh.
        appendFirst(task, teil, List.of("instruction_de", "instruction_vi"));
        // Chủ đề hoặc tình huống của đề.
        appendFirst(task, teil, List.of("input_email", "prompt", "instructions"));
        if (teil.get("writing_points") instanceof List<?> points && !points.isEmpty()) {
            task.append("\nDiese Punkte müssen im Text vorkommen:");
            int i = 1;
            for (Object point : points) {
                if (point != null) task.append("\n").append(i++).append(". ").append(point);
            }
        }
        return task.toString().trim();
    }

    private void appendFirst(StringBuilder target, Map<String, Object> teil, List<String> keys) {
        for (String key : keys) {
            if (teil.get(key) instanceof String value && !value.isBlank()) {
                if (target.length() > 0) target.append("\n");
                target.append(value.trim());
                return;
            }
        }
    }

    private Map<String, Object> taskDetail(Map<String, Object> teil, String kind,
                                           double weight, double points, String status) {
        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("teil", teil.get("teil"));
        detail.put("kind", kind);
        detail.put("max", (int) Math.round(weight));
        detail.put("total", (int) Math.round(points));
        detail.put("status", status);
        return detail;
    }

    // ─── Nói ─────────────────────────────────────────────────────────────────

    /**
     * Chấm phần Nói bằng AI khi có transcript. Không có transcript (trình chạy web hiện chưa gửi)
     * thì phần này là "chờ chấm" — bị loại khỏi tổng điểm thay vì tính 0.
     */
    public Map<String, Object> scoreSprechenSection(long userId, Map<String, Object> answers,
                                                    Map<String, Object> section, String cefrLevel) {
        int max = sectionMax(section);
        String transcript = extractTranscript(answers);
        if (transcript.isBlank()) {
            return scoredSection(0, max, STATUS_PENDING);
        }

        Map<String, Object> ai = aiEvaluator.evaluateSprechen(
                userId, transcript, extractSprechenTaskPrompt(section), examLevel(section, cefrLevel));
        if (isPending(ai)) {
            Map<String, Object> pending = scoredSection(0, max, STATUS_PENDING);
            pending.put("ai_evaluation", ai);
            return pending;
        }

        int points = (int) Math.round(max * clamp01(numberOf(ai.get("total")) / AI_SPRECHEN_MAX));
        Map<String, Object> out = scoredSection(points, max, STATUS_COMPLETED);
        out.put("ai_evaluation", ai);
        return out;
    }

    private String extractTranscript(Map<String, Object> answers) {
        for (String key : List.of("sprechen_transcript", "transcript", "speaking_transcript", "audio_transcript")) {
            Object value = answers.get(key);
            if (value instanceof String s && !s.isBlank()) return s;
        }
        return "";
    }

    private String extractSprechenTaskPrompt(Map<String, Object> section) {
        List<Map<String, Object>> teile = teileList(section);
        return teile.isEmpty() ? "" : taskPrompt(teile.get(0));
    }

    /**
     * Trình độ dùng để chọn rubric AI: ưu tiên trình độ của ĐỀ (cột {@code mock_exams.cefr_level}),
     * sau đó tới trường trong chính phần thi, cuối cùng mới mặc định B1. Trước 07/09/2026 nhánh
     * chấm Viết không nhận trình độ nào và prompt đóng cứng A1, còn nhánh chấm Nói chỉ đọc trường
     * trong phần thi — mà seed không có trường đó, nên mọi đề đều rơi về mặc định.
     */
    private String examLevel(Map<String, Object> section, String cefrLevel) {
        if (cefrLevel != null && !cefrLevel.isBlank()) return cefrLevel;
        for (String key : List.of("cefr_level", "cefrLevel")) {
            if (section.get(key) instanceof String s && !s.isBlank()) return s;
        }
        return "B1";
    }

    // ─── Tổng kết ────────────────────────────────────────────────────────────

    /** Tổng điểm quy về thang 100 trên các phần đã chấm được, kèm kết luận đỗ/trượt. */
    public record ExamTotals(int totalScore, int rawPoints, int scoredMax, boolean passed) {}

    /**
     * Cộng các phần đã chấm xong: {@code totalScore} là thang 100 trên đúng phần chấm được, nên
     * một bài chưa chấm được phần Nói vẫn có thể đỗ nếu 3 phần kia đạt ngưỡng.
     */
    public ExamTotals summarize(Map<String, Object> detailedScores, int passPercent) {
        int raw = 0;
        int scoredMax = 0;
        for (String name : SECTION_ORDER) {
            if (!(detailedScores.get(name) instanceof Map<?, ?> rawSection)) continue;
            Map<String, Object> section = castMap(rawSection);
            if (isPending(section)) continue;
            raw += (int) numberOf(section.get("total"));
            scoredMax += (int) numberOf(section.get("max"));
        }
        int total = scoredMax > 0 ? (int) Math.round(raw * 100.0 / scoredMax) : 0;
        return new ExamTotals(total, raw, scoredMax, scoredMax > 0 && total >= passPercent);
    }

    /** Ngưỡng đỗ của đề tính theo phần trăm ({@code pass_points}/{@code total_points}). */
    public static int passPercent(Integer passPoints, Integer totalPoints) {
        if (passPoints == null || totalPoints == null || totalPoints <= 0) return DEFAULT_PASS_PERCENT;
        return (int) Math.round(passPoints * 100.0 / totalPoints);
    }

    /** Các phần đã chấm mà dưới 60% — phần chờ chấm không bị gọi là điểm yếu. */
    public List<String> identifyWeakAreas(Map<String, Object> detailedScores) {
        List<String> weakAreas = new ArrayList<>();
        for (String name : SECTION_ORDER) {
            if (!(detailedScores.get(name) instanceof Map<?, ?> rawSection)) continue;
            Map<String, Object> section = castMap(rawSection);
            if (isPending(section)) continue;
            int max = (int) numberOf(section.get("max"));
            if (max <= 0) continue;
            int percentage = (int) Math.round(numberOf(section.get("total")) * 100.0 / max);
            if (percentage < WEAK_AREA_PERCENT) weakAreas.add(name);
        }
        return weakAreas;
    }

    // ─── Trợ giúp ────────────────────────────────────────────────────────────

    private Map<String, Object> scoredSection(int points, int max, String status) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", points);
        out.put("max", max);
        out.put("percentage", max > 0 ? (int) Math.round(points * 100.0 / max) : 0);
        out.put("status", status);
        return out;
    }

    private int sectionMax(Map<String, Object> section) {
        double max = numberOf(section.get("max_points"));
        return max > 0 ? (int) Math.round(max) : DEFAULT_SECTION_MAX;
    }

    /**
     * Chuẩn hoá {@code teile} về danh sách. Chấp nhận cả mảng JSON (hầu hết đề) lẫn object map —
     * trước đây khác kiểu là ném ClassCastException ngay lúc nộp bài.
     */
    private List<Map<String, Object>> teileList(Map<String, Object> section) {
        Object raw = section.get("teile");
        Collection<?> values;
        if (raw instanceof List<?> list) {
            values = list;
        } else if (raw instanceof Map<?, ?> map) {
            values = map.values();
        } else {
            return List.of();
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object value : values) {
            if (value instanceof Map<?, ?> m) out.add(castMap(m));
        }
        return out;
    }

    private static boolean isPending(Map<String, Object> section) {
        Object status = section.get("status");
        return status != null && status.toString().contains("PENDING");
    }

    private static double numberOf(Object value) {
        return value instanceof Number n ? n.doubleValue() : 0;
    }

    private static double clamp01(double value) {
        return Math.max(0, Math.min(1, value));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> castMap(Map<?, ?> map) {
        return (Map<String, Object>) map;
    }
}
