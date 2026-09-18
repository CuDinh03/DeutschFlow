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

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(ExamScoringService.class);

    /** Phần đã chấm xong — vào cả tử số lẫn mẫu số của tổng điểm. */
    public static final String STATUS_COMPLETED = "COMPLETED";
    /** Phần chưa chấm được (thiếu dữ liệu hoặc AI hỏng) — bị loại khỏi tổng điểm. */
    public static final String STATUS_PENDING = "PENDING_AI_EVALUATION";
    /**
     * Phần mà ỨNG DỤNG của học viên không hiển thị được nên họ không có cơ hội làm (app điện thoại
     * hiện chỉ dựng được phần Đọc) — cũng bị loại khỏi tổng điểm, vì tính 0 điểm ở đây là trừ điểm
     * một người vì giới hạn của phần mềm, không phải vì năng lực.
     *
     * <p>🔴 Trạng thái này chỉ được đặt khi phần đó KHÔNG có một câu trả lời nào
     * ({@link #hasAnyAnswer}): khai báo của client không được phép xoá điểm một phần đã làm. Và vì
     * nó làm mẫu số nhỏ đi, một bài có phần mang trạng thái này KHÔNG được dùng để nhận chứng nhận
     * (xem {@code CertificateController}) — bằng không thì khai bừa là một đường hạ ngưỡng đỗ.
     */
    public static final String STATUS_SKIPPED_ON_CLIENT = "SKIPPED_ON_CLIENT";

    /** Cổng đỗ đã đủ dữ liệu và đạt ngưỡng. */
    public static final String GATE_PASSED = "PASSED";
    /** Cổng đỗ đã đủ dữ liệu và KHÔNG đạt ngưỡng. */
    public static final String GATE_FAILED = "FAILED";
    /**
     * Cổng đỗ chưa đủ dữ liệu để kết luận — thiếu một phần chưa chấm được, hoặc (cổng Nói của
     * telc) chưa có phiên thi nói nào được ghép vào lần thi này. Không phải trượt.
     */
    public static final String GATE_PENDING = "PENDING";

    /**
     * Thứ tự phần trong một bài thi. {@code SPRACHBAUSTEINE} là phần riêng của telc (Goethe không
     * có) — đề nào không khai phần này thì nó vắng mặt trong {@code detailedScores} và tự nằm
     * ngoài mọi phép cộng, nên thêm vào đây không đổi điểm của bất kỳ đề Goethe nào.
     */
    private static final List<String> SECTION_ORDER =
            List.of("LESEN", "SPRACHBAUSTEINE", "HOEREN", "SCHREIBEN", "SPRECHEN");
    private static final int DEFAULT_SECTION_MAX = 25;
    private static final int DEFAULT_PASS_PERCENT = 60;
    private static final int WEAK_AREA_PERCENT = 60;
    /** Phần Viết có cả form lẫn bài viết: form giữ tỉ trọng 40% (đúng thang 10/25 dùng từ trước). */
    private static final double FORM_SHARE = 0.4;
    /** Thang thô mặc định của {@link AiExamEvaluatorService#evaluateSchreibenEmail} khi phiếu không nói rõ. */
    private static final double AI_EMAIL_MAX = 15;
    /** Thang thô mặc định của {@link AiExamEvaluatorService#evaluateSprechen} khi phiếu không nói rõ. */
    private static final double AI_SPRECHEN_MAX = 18;

    private final AiExamEvaluatorService aiEvaluator;

    public ExamScoringService(AiExamEvaluatorService aiEvaluator) {
        this.aiEvaluator = aiEvaluator;
    }

    // ─── Đọc / Nghe ──────────────────────────────────────────────────────────

    /**
     * Chấm một phần khách quan (LESEN/HOEREN/SPRACHBAUSTEINE). Hai luật, chọn theo dữ liệu đề:
     *
     * <ul>
     *   <li><b>Tỉ lệ</b> (mặc định, mọi đề Goethe): mỗi câu nặng như nhau, điểm = {@code max_points}
     *       × số câu đúng / tổng số câu.</li>
     *   <li><b>Trọng số</b> (telc): đề khai {@code point_per_item} ở cấp Teil hoặc {@code points} ở
     *       cấp câu. Cần thiết vì telc cho điểm khác nhau NGAY TRONG một phần — Leseverstehen là
     *       5 đ/câu ở Teil 1–2 nhưng 2,5 đ/câu ở Teil 3, luật tỉ lệ không diễn tả được.</li>
     * </ul>
     *
     * <p>Luật trọng số chỉ bật khi <b>mọi</b> câu trong phần đều tra được trọng số. Khai nửa vời là
     * seed lỗi: lúc đó quay về luật tỉ lệ và ghi cảnh báo, chứ không bịa trọng số cho câu còn
     * thiếu — bịa thì điểm vẫn ra một con số trông hợp lý và không ai phát hiện.
     */
    public Map<String, Object> scoreObjectiveSection(Map<String, Object> answers, Map<String, Object> section) {
        int max = sectionMax(section);
        int correct = 0;
        int itemCount = 0;
        double earnedWeight = 0;
        double totalWeight = 0;
        boolean anyWeightDeclared = false;
        boolean everyItemWeighted = true;

        for (Map<String, Object> teil : teileList(section)) {
            if (!(teil.get("items") instanceof List<?> items)) continue;
            Double teilWeight = positiveNumber(teil.get("point_per_item"));
            for (Object itemObj : items) {
                if (!(itemObj instanceof Map<?, ?> raw)) continue;
                Map<String, Object> item = castMap(raw);
                Object id = item.get("id");
                Object expected = item.get("correct");
                if (id == null || expected == null) continue;
                itemCount++;

                Double itemWeight = positiveNumber(item.get("points"));
                Double weight = itemWeight != null ? itemWeight : teilWeight;
                if (weight == null) {
                    everyItemWeighted = false;
                } else {
                    anyWeightDeclared = true;
                    totalWeight += weight;
                }

                Object given = answers.get(id.toString());
                if (given != null && given.toString().trim().equalsIgnoreCase(expected.toString().trim())) {
                    correct++;
                    if (weight != null) earnedWeight += weight;
                }
            }
        }

        boolean weighted = anyWeightDeclared && everyItemWeighted && totalWeight > 0;
        if (anyWeightDeclared && !everyItemWeighted) {
            log.warn("[MockExam] Phần '{}' khai trọng số câu nửa vời — chấm theo tỉ lệ. Sửa seed để mọi câu "
                    + "có point_per_item (cấp Teil) hoặc points (cấp câu).", section.get("name"));
        }

        int points;
        int sectionMax;
        if (weighted) {
            points = (int) Math.round(earnedWeight);
            sectionMax = (int) Math.round(totalWeight);
            if (sectionMax != max) {
                log.warn("[MockExam] Phần '{}' khai max_points={} nhưng tổng trọng số câu là {} — dùng tổng "
                        + "trọng số. Hai con số này phải khớp nhau trong seed.", section.get("name"), max, sectionMax);
            }
        } else {
            points = itemCount > 0 ? (int) Math.round(max * (double) correct / itemCount) : 0;
            sectionMax = max;
        }

        Map<String, Object> out = scoredSection(points, sectionMax, STATUS_COMPLETED);
        out.put("correct_items", correct);
        out.put("total_items", itemCount);
        return out;
    }

    /** Số dương trong dữ liệu đề, hoặc {@code null} nếu khoá vắng mặt / không phải số dương. */
    private static Double positiveNumber(Object value) {
        if (value instanceof Number n && n.doubleValue() > 0) return n.doubleValue();
        if (value instanceof String str) {
            try {
                double parsed = Double.parseDouble(str.trim());
                if (parsed > 0) return parsed;
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    // ─── Viết ────────────────────────────────────────────────────────────────

    /**
     * Chấm phần Viết. Mỗi Teil là một nhiệm vụ: có {@code form_fields} thì chấm tự động theo số ô
     * đã điền, còn lại là bài viết chấm bằng AI. Bỏ trống = 0 điểm (học viên không làm); AI hỏng =
     * chờ chấm (nhiệm vụ đó rời khỏi mẫu số, không kéo điểm học viên xuống).
     */
    public Map<String, Object> scoreSchreibenSection(long userId, Map<String, Object> answers,
                                                     Map<String, Object> section, String cefrLevel) {
        return scoreSchreibenSection(userId, answers, section, cefrLevel, null);
    }

    /**
     * @param examFormat quyết định bảng tiêu chí gửi cho AI ({@code "TELC"} = 3 Kriterien × 15,
     *                   còn lại = bảng Goethe). Phần Viết telc là MỘT bức thư và không có ô form,
     *                   nên {@link #FORM_SHARE} tự nằm ngoài cuộc: {@code formPool} = 0 khi đề
     *                   không khai {@code form_fields}.
     */
    public Map<String, Object> scoreSchreibenSection(long userId, Map<String, Object> answers,
                                                     Map<String, Object> section, String cefrLevel,
                                                     String examFormat) {
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
                    userId, text, taskPrompt(teil), examLevel(section, cefrLevel), examFormat);
            if (firstAiEval == null) firstAiEval = ai;
            if (isPending(ai)) {
                tasks.add(taskDetail(teil, "WRITING", weight, 0, STATUS_PENDING));
                continue;
            }
            double ratio = clamp01(numberOf(ai.get("total")) / aiMax(ai, AI_EMAIL_MAX));
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
        // Văn bản kích thích của đề telc (17/09/2026): E-Mail của bạn / mẩu tin / thư mà bài viết trả
        // lời. Không gửi thì AI không biết học viên có phản hồi đúng điều người kia hỏi hay không.
        if (teil.get("stimulus") instanceof Map<?, ?> stimulus) appendStimulus(task, stimulus);
        if (teil.get("writing_points") instanceof List<?> points && !points.isEmpty()) {
            task.append("\nDiese Punkte müssen im Text vorkommen:");
            int i = 1;
            for (Object point : points) {
                if (point != null) task.append("\n").append(i++).append(". ").append(point);
            }
        }
        return task.toString().trim();
    }

    private void appendStimulus(StringBuilder task, Map<?, ?> stimulus) {
        Object typeRaw = stimulus.get("type");
        String type = typeRaw == null ? "TEXT" : String.valueOf(typeRaw);
        String heading = switch (type) {
            case "EMAIL" -> "E-Mail, auf die geantwortet wird";
            case "AD" -> "Anzeige, auf die geantwortet wird";
            case "LETTER" -> "Brief, auf den geantwortet wird";
            default -> "Text, auf den geantwortet wird";
        };
        task.append("\n\n").append(heading).append(":");
        if (stimulus.get("from") instanceof String from && !from.isBlank()) task.append("\nVon: ").append(from.trim());
        if (stimulus.get("subject") instanceof String subject && !subject.isBlank()) {
            task.append("\nBetreff: ").append(subject.trim());
        }
        if (stimulus.get("body") instanceof String body && !body.isBlank()) task.append("\n").append(body.trim());
        task.append("\n");
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

        int points = (int) Math.round(max * clamp01(numberOf(ai.get("total")) / aiMax(ai, AI_SPRECHEN_MAX)));
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

    // ─── Phần client không dựng được ─────────────────────────────────────────

    /**
     * Phần mà ứng dụng của học viên không hiển thị được: giữ đúng thang điểm của đề để phiếu kết
     * quả vẫn đọc được "0/25 — chưa làm được trên app", nhưng mang {@link #STATUS_SKIPPED_ON_CLIENT}
     * nên {@link #summarize} bỏ nó khỏi cả tử số lẫn mẫu số.
     */
    public Map<String, Object> skippedOnClientSection(Map<String, Object> section) {
        return scoredSection(0, sectionMax(section), STATUS_SKIPPED_ON_CLIENT);
    }

    /**
     * Học viên có chạm vào phần này chưa? Kiểm ĐÚNG tập khoá mà ba nhánh chấm ở trên đang đọc —
     * id của từng câu khách quan, {@code form_<chỉ số ô>}, {@code email_<teil>} /
     * {@code schreiben_<teil>} / {@code email_section}, và các khoá transcript của phần Nói.
     *
     * <p>Dùng làm cổng cho khai báo "không làm được trên app" của client: chỉ chấp nhận khi phần đó
     * trắng hoàn toàn. Nếu học viên đã trả lời dù một câu thì khai báo bị bỏ ngoài tai và phần đó
     * được chấm như thường — nếu không, một client sửa được sẽ dùng khai báo này để xoá phần điểm
     * thấp của mình khỏi mẫu số.
     */
    public boolean hasAnyAnswer(Map<String, Object> answers, Map<String, Object> section) {
        if (answers == null || answers.isEmpty()) return false;
        for (Map<String, Object> teil : teileList(section)) {
            if (teil.get("items") instanceof List<?> items) {
                for (Object itemObj : items) {
                    if (!(itemObj instanceof Map<?, ?> raw)) continue;
                    Object id = castMap(raw).get("id");
                    if (id != null && hasValue(answers, id.toString())) return true;
                }
            }
            if (teil.get("form_fields") instanceof List<?> fields) {
                for (int i = 0; i < fields.size(); i++) {
                    if (hasValue(answers, "form_" + i)) return true;
                }
            }
            Object teilNo = teil.get("teil");
            if (teilNo != null
                    && (hasValue(answers, "email_" + teilNo) || hasValue(answers, "schreiben_" + teilNo))) {
                return true;
            }
        }
        for (String key : List.of("email_section", "sprechen_transcript", "transcript",
                "speaking_transcript", "audio_transcript")) {
            if (hasValue(answers, key)) return true;
        }
        return false;
    }

    private static boolean hasValue(Map<String, Object> answers, String key) {
        Object value = answers.get(key);
        return value != null && !value.toString().isBlank();
    }

    // ─── Tổng kết ────────────────────────────────────────────────────────────

    /**
     * Một ngưỡng đỗ độc lập. telc có hai: {@code written} (135/225) và {@code oral} (45/75), và
     * giỏi bên này KHÔNG bù được bên kia — nên không thể diễn tả bằng một con số phần trăm.
     *
     * @param id     tên cổng trong {@code pass_rule} ({@code written} / {@code oral})
     * @param raw    điểm thô đã cộng được của cổng này
     * @param max    điểm tối đa của cổng
     * @param min    ngưỡng đỗ tuyệt đối (điểm, không phải phần trăm)
     * @param status     {@link #GATE_PASSED} / {@link #GATE_FAILED} / {@link #GATE_PENDING}
     * @param sourceId   bản ghi ngoài đề giấy đã cấp điểm cho cổng này (phiên thi nói), hoặc
     *                   {@code null} với cổng cộng từ chính đề giấy / cổng chưa có nguồn
     * @param achievedAt thời điểm của bản ghi đó — học viên phải thấy được điểm Nói này lấy từ
     *                   lần thi nào, bằng không thì một kết luận ĐỖ/TRƯỢT hiện ra mà không giải
     *                   thích được từ đâu
     */
    public record Gate(String id, int raw, int max, int min, String status,
                       Long sourceId, java.time.Instant achievedAt) {}

    /**
     * Điểm đến từ NGOÀI đề giấy cho một cổng. Đề telc dùng cho cổng Nói: đề giấy telc không có
     * phần Nói, điểm 75 lấy từ một phiên của module luyện thi nói.
     */
    public record ExternalScore(double raw, Long sourceId, java.time.Instant achievedAt) {}

    /**
     * Tổng điểm quy về thang 100 trên các phần đã chấm được, kèm kết luận đỗ/trượt.
     *
     * @param gates rỗng với đề Goethe (một ngưỡng phần trăm); với đề telc là hai cổng độc lập
     */
    public record ExamTotals(int totalScore, int rawPoints, int scoredMax, boolean passed, List<Gate> gates) {}

    /** Đề một ngưỡng (Goethe) — giữ nguyên hành vi từ 07/09/2026. */
    public ExamTotals summarize(Map<String, Object> detailedScores, int passPercent) {
        return summarize(detailedScores, passPercent, null);
    }

    /**
     * Cộng các phần đã chấm xong: {@code totalScore} là thang 100 trên đúng phần chấm được, nên
     * một bài chưa chấm được phần Nói vẫn có thể đỗ nếu 3 phần kia đạt ngưỡng.
     *
     * <p>Khi đề khai {@code pass_rule} (telc), kết luận đỗ/trượt chuyển sang các cổng: <b>trượt khi
     * và chỉ khi có một cổng TRƯỢT</b>. Cổng chưa đủ dữ liệu là CHỜ chứ không phải trượt — cùng
     * nguyên tắc với phần chờ chấm: không kết luận trượt cho một người vì họ chưa thi xong, hay vì
     * hạ tầng của ta chưa chấm được.
     *
     * @param passRule nội dung khoá {@code pass_rule} ở gốc {@code sections_json}; {@code null} với
     *                 đề không khai (mọi đề Goethe) ⇒ dùng ngưỡng phần trăm như cũ
     */
    public ExamTotals summarize(Map<String, Object> detailedScores, int passPercent, Map<String, Object> passRule) {
        return summarize(detailedScores, passPercent, passRule, Map.of());
    }

    /**
     * @param externalScores điểm từ ngoài đề giấy, khoá là tên cổng trong {@code pass_rule}
     *                       (đề telc: {@code "oral"}). Cổng khai {@code source} mà không có mục
     *                       tương ứng ở đây thì là CHỜ.
     */
    public ExamTotals summarize(Map<String, Object> detailedScores, int passPercent,
                                Map<String, Object> passRule,
                                Map<String, ExternalScore> externalScores) {
        int raw = 0;
        int scoredMax = 0;
        for (String name : SECTION_ORDER) {
            if (!(detailedScores.get(name) instanceof Map<?, ?> rawSection)) continue;
            Map<String, Object> section = castMap(rawSection);
            if (!isScored(section)) continue;
            raw += (int) numberOf(section.get("total"));
            scoredMax += (int) numberOf(section.get("max"));
        }
        int total = scoredMax > 0 ? (int) Math.round(raw * 100.0 / scoredMax) : 0;

        List<Gate> gates = evaluateGates(detailedScores, passRule, externalScores);
        if (gates.isEmpty()) {
            return new ExamTotals(total, raw, scoredMax, scoredMax > 0 && total >= passPercent, gates);
        }
        // Đỗ khi và chỉ khi MỌI cổng đều ĐẠT. Cổng còn CHỜ nghĩa là chưa kết luận được, và "chưa
        // kết luận" không phải "đỗ": nói với một người rằng họ đã đỗ telc trong khi họ chưa thi
        // nói là sai, và cột `passed` này chính là thứ `/api/certificates/claim` lọc theo — để
        // lỏng ở đây là mở một đường lấy chứng nhận bằng nửa kỳ thi. Sắc thái "chờ" nói bằng
        // `gates`, không nói bằng một giá trị boolean không diễn tả nổi ba trạng thái.
        boolean allPassed = gates.stream().allMatch(g -> GATE_PASSED.equals(g.status()));
        return new ExamTotals(total, raw, scoredMax, allPassed, gates);
    }

    /**
     * Dựng kết luận cho từng cổng của {@code pass_rule}. Hai kiểu cổng:
     *
     * <ul>
     *   <li>khai {@code sections} — cộng các phần của đề giấy. Thiếu <b>bất kỳ</b> phần nào (vắng
     *       mặt, chờ chấm, hoặc client không dựng được) thì cổng là CHỜ: đem một phần điểm ra so
     *       với ngưỡng của cả cổng là kết luận trượt oan (70/75 điểm Đọc không phải là 70/225).</li>
     *   <li>khai {@code source} — điểm đến từ ngoài đề giấy. Hiện chỉ có
     *       {@code SPEAKING_SESSION}: phần Nói telc chấm ở module luyện thi nói, chưa ghép vào lần
     *       thi này nên luôn CHỜ. Việc ghép làm ở đợt sau.</li>
     * </ul>
     */
    private List<Gate> evaluateGates(Map<String, Object> detailedScores, Map<String, Object> passRule,
                                     Map<String, ExternalScore> externalScores) {
        if (passRule == null || passRule.isEmpty()) return List.of();
        List<Gate> gates = new ArrayList<>();
        for (Map.Entry<String, Object> entry : passRule.entrySet()) {
            if (!(entry.getValue() instanceof Map<?, ?> rawGate)) continue;
            Map<String, Object> spec = castMap(rawGate);
            int max = (int) numberOf(spec.get("max"));
            int min = (int) numberOf(spec.get("min"));

            if (!(spec.get("sections") instanceof List<?> sectionNames) || sectionNames.isEmpty()) {
                // Cổng lấy điểm từ ngoài đề giấy (telc: phần Nói chấm ở module luyện thi nói).
                ExternalScore external = externalScores.get(entry.getKey());
                if (external == null) {
                    gates.add(new Gate(entry.getKey(), 0, max, min, GATE_PENDING, null, null));
                } else {
                    int gateRaw = (int) Math.round(external.raw());
                    gates.add(new Gate(entry.getKey(), gateRaw, max, min,
                            gateRaw >= min ? GATE_PASSED : GATE_FAILED,
                            external.sourceId(), external.achievedAt()));
                }
                continue;
            }

            int gateRaw = 0;
            boolean complete = true;
            for (Object nameObj : sectionNames) {
                if (nameObj == null) continue;
                Object stored = detailedScores.get(nameObj.toString());
                if (!(stored instanceof Map<?, ?> rawSection)) { complete = false; continue; }
                Map<String, Object> section = castMap(rawSection);
                if (!isScored(section)) { complete = false; continue; }
                gateRaw += (int) numberOf(section.get("total"));
            }
            String status = !complete ? GATE_PENDING : (gateRaw >= min ? GATE_PASSED : GATE_FAILED);
            gates.add(new Gate(entry.getKey(), complete ? gateRaw : 0, max, min, status, null, null));
        }
        return gates;
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
            if (!isScored(section)) continue;
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

    /**
     * Chỉ phần ĐÃ CHẤM XONG vào tử số và mẫu số của tổng điểm. Kiểm theo {@link #STATUS_COMPLETED}
     * chứ không theo danh sách các trạng thái bị loại: thêm một trạng thái "không chấm được" mới
     * thì nó tự nằm ngoài tổng, không cần sửa {@link #summarize} lần nữa.
     */
    private static boolean isScored(Map<String, Object> section) {
        return STATUS_COMPLETED.equals(String.valueOf(section.get("status")));
    }

    /**
     * Thang thô của phiếu AI. Khi mô hình bỏ sót một tiêu chí, evaluator loại tiêu chí đó khỏi cả
     * tử số lẫn mẫu số và trả {@code max} nhỏ hơn — chia theo hằng số cũ sẽ biến thiếu dữ liệu
     * thành mất điểm.
     */
    private static double aiMax(Map<String, Object> ai, double macDinh) {
        double max = numberOf(ai.get("max"));
        return max > 0 ? max : macDinh;
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
