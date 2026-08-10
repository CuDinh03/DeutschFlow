package com.deutschflow.speaking.interview;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Hàng rào "cấm bịa" cho báo cáo phỏng vấn (kế hoạch 10/08/2026, đợt A):
 *
 * <ol>
 *   <li>Schema: đúng 4 categories, score 0–10.</li>
 *   <li>Trích dẫn: mỗi category phải có ≥1 trích dẫn nguyên văn („…"/"…") khớp lời ỨNG VIÊN
 *       trong transcript (so khớp sau chuẩn hoá chữ thường + bỏ dấu câu). Nhận xét không có
 *       bằng chứng ⇒ không hợp lệ.</li>
 *   <li>Sanity-cap từ số liệu khách quan của orchestrator: không có ví dụ cụ thể ⇒ Fachkompetenz ≤ 5;
 *       ứng viên nói &lt; 100 từ ⇒ mọi category ≤ 6. (Cap là TRẦN chống thổi phồng.)</li>
 *   <li>overall_score + verdict do SERVER tính lại từ 4 điểm thành phần (đã cap) — model trả gì
 *       cũng bị ghi đè: trung bình làm tròn 0.5; ≥7.5 PASS · ≥5.0 CONDITIONAL_PASS · &lt;5.0 NOT_PASS.</li>
 * </ol>
 *
 * Report không qua validator thì KHÔNG BAO GIỜ được lưu — caller lưu {@link #evalFailed} thay thế.
 */
@org.springframework.stereotype.Component
public class InterviewReportValidator {

    public static final String TYPE_INSUFFICIENT_DATA = "INSUFFICIENT_DATA";
    public static final String TYPE_EVAL_FAILED = "EVAL_FAILED";

    private static final int EXPECTED_CATEGORIES = 4;
    private static final double PASS_THRESHOLD = 7.5;
    private static final double CONDITIONAL_THRESHOLD = 5.0;
    private static final int LOW_WORDS_CAP_THRESHOLD = 100;
    private static final int LOW_WORDS_CAP = 6;
    private static final int NO_EXAMPLE_FACH_CAP = 5;
    /** Trích dẫn sau chuẩn hoá phải dài tối thiểu chừng này mới tính là bằng chứng. */
    private static final int MIN_QUOTE_CHARS = 8;

    // „…" (Đức), "…", “…”, ‚…‘, »…« — bắt phần ruột không chứa dấu đóng tương ứng.
    private static final Pattern QUOTE = Pattern.compile(
            "[„\"“‚»‘]([^„\"“”‚’«»‘]{4,300})[\"“”’«»‘]");

    private final ObjectMapper objectMapper;

    public InterviewReportValidator(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public record ValidationResult(boolean valid, String normalizedJson, List<String> failures) {}

    /**
     * @param rawReport  chuỗi model trả (có thể lẫn fence/markdown)
     * @param userTexts  toàn bộ lời ỨNG VIÊN trong phiên (nguyên văn, theo thứ tự)
     * @param state      orchestrator state cuối phiên (nullable — thiếu thì bỏ qua cap theo state)
     */
    public ValidationResult validate(String rawReport, List<String> userTexts, InterviewSessionState state) {
        List<String> failures = new ArrayList<>();
        JsonNode root = parseLenient(rawReport);
        if (root == null || !root.isObject()) {
            return new ValidationResult(false, null, List.of("JSON không parse được (cụt hoặc sai cú pháp)"));
        }

        JsonNode cats = root.get("categories");
        if (cats == null || !cats.isArray() || cats.size() != EXPECTED_CATEGORIES) {
            failures.add("categories phải có đúng " + EXPECTED_CATEGORIES + " mục (đang có "
                    + (cats == null ? 0 : cats.size()) + ")");
            return new ValidationResult(false, null, failures);
        }

        String userCorpus = normalize(String.join("   ", userTexts));
        int userWords = countWords(userTexts);

        ObjectNode mutable = (ObjectNode) root;
        ArrayNode catArray = (ArrayNode) cats;
        double sum = 0;
        for (int i = 0; i < catArray.size(); i++) {
            JsonNode cat = catArray.get(i);
            String name = cat.path("name_vi").asText("");
            if (name.isBlank()) {
                failures.add("category[" + i + "] thiếu name_vi");
                continue;
            }
            JsonNode scoreNode = cat.get("score");
            if (scoreNode == null || !scoreNode.isNumber()
                    || scoreNode.asDouble() < 0 || scoreNode.asDouble() > 10) {
                failures.add("category '" + name + "' score không hợp lệ (phải là số 0–10)");
                continue;
            }
            if (!hasVerifiedQuote(cat, userCorpus)) {
                failures.add("category '" + name + "' không có trích dẫn nguyên văn nào khớp lời ứng viên"
                        + " — mọi nhận xét phải kèm bằng chứng „…\" từ transcript");
                continue;
            }
            double score = scoreNode.asDouble();
            double capped = applyCaps(name, score, state, userWords);
            if (capped != score) {
                ((ObjectNode) cat).put("score", capped);
                appendCapNote((ObjectNode) cat, score, capped);
            }
            sum += capped;
        }
        if (!failures.isEmpty()) {
            return new ValidationResult(false, null, failures);
        }

        // Server tính lại điểm tổng + verdict — nguồn sự thật duy nhất, model hết quyền phán.
        double overall = Math.round((sum / EXPECTED_CATEGORIES) * 2) / 2.0;
        mutable.put("overall_score", formatScore(overall) + "/10");
        String verdict = overall >= PASS_THRESHOLD ? "PASS"
                : overall >= CONDITIONAL_THRESHOLD ? "CONDITIONAL_PASS" : "NOT_PASS";
        mutable.put("verdict", verdict);
        mutable.put("verdict_label_vi", switch (verdict) {
            case "PASS" -> "Đạt";
            case "CONDITIONAL_PASS" -> "Đạt có điều kiện";
            default -> "Chưa đạt";
        });

        try {
            return new ValidationResult(true, objectMapper.writeValueAsString(mutable), List.of());
        } catch (Exception e) {
            return new ValidationResult(false, null, List.of("serialize lại thất bại: " + e.getMessage()));
        }
    }

    /** Report "chưa đủ dữ liệu" — lưu thay vì gọi LLM khi ứng viên nói quá ít. */
    public String insufficientData(int userTurns, int userWords, int minTurns, int minWords) {
        ObjectNode n = objectMapper.createObjectNode();
        n.put("type", TYPE_INSUFFICIENT_DATA);
        n.put("user_turns", userTurns);
        n.put("user_words", userWords);
        n.put("min_turns", minTurns);
        n.put("min_words", minWords);
        return n.toString();
    }

    /** Report "chấm thất bại sau retry" — trạng thái retryable, lần end sau được chấm lại. */
    public String evalFailed(List<String> failures) {
        ObjectNode n = objectMapper.createObjectNode();
        n.put("type", TYPE_EVAL_FAILED);
        ArrayNode arr = n.putArray("failures");
        failures.stream().limit(5).forEach(arr::add);
        return n.toString();
    }

    /**
     * C2 (Đợt C 10/08): server là nguồn sự thật duy nhất về lỗi ngữ pháp. Phiên không có lỗi nào
     * được ghi nhận ⇒ {@code german_language.common_errors_vi} bị ép RỖNG — model có "sáng tác"
     * thêm lỗi cũng bị cắt trước khi lưu.
     */
    public String trimUngroundedErrors(String normalizedJson, boolean hasServerErrors) {
        if (hasServerErrors || normalizedJson == null) {
            return normalizedJson;
        }
        try {
            JsonNode root = objectMapper.readTree(normalizedJson);
            JsonNode german = root.get("german_language");
            if (german != null && german.isObject()) {
                ArrayNode errs = ((ObjectNode) german).putArray("common_errors_vi");
                errs.removeAll();
            }
            return objectMapper.writeValueAsString(root);
        } catch (Exception e) {
            return normalizedJson;
        }
    }

    /**
     * Đợt D (10/08): lọc next_steps — chỉ giữ mã thuộc danh mục VÀ nằm trong tập điều kiện
     * server đã tính ({@link InterviewNextStepCatalog#allowedFor}); tối đa 3. Đồng thời lọc
     * answer_upgrades: câu gốc phải là TRÍCH DẪN THẬT của ứng viên, bản "nên nói" không rỗng —
     * gợi ý sửa một câu ứng viên chưa từng nói là gợi ý bịa.
     */
    public String sanitizeNextSteps(String normalizedJson, java.util.Set<String> allowedCodes,
                                    List<String> userTexts) {
        if (normalizedJson == null) {
            return null;
        }
        try {
            JsonNode root = objectMapper.readTree(normalizedJson);
            ObjectNode mutable = (ObjectNode) root;
            String userCorpus = normalize(String.join("   ", userTexts));

            ArrayNode kept = objectMapper.createArrayNode();
            JsonNode steps = root.get("next_steps");
            if (steps != null && steps.isArray()) {
                for (JsonNode step : steps) {
                    String code = step.path("code").asText("");
                    if (kept.size() < 3 && allowedCodes.contains(code)
                            && InterviewNextStepCatalog.isKnown(code)) {
                        kept.add(step);
                    }
                }
            }
            mutable.set("next_steps", kept);

            ArrayNode keptUpgrades = objectMapper.createArrayNode();
            JsonNode upgrades = root.get("answer_upgrades");
            if (upgrades != null && upgrades.isArray()) {
                for (JsonNode up : upgrades) {
                    String original = normalize(up.path("original_quote").asText(""));
                    String better = up.path("better_de").asText("");
                    if (keptUpgrades.size() < 2 && original.length() >= MIN_QUOTE_CHARS
                            && userCorpus.contains(original) && !better.isBlank()) {
                        keptUpgrades.add(up);
                    }
                }
            }
            mutable.set("answer_upgrades", keptUpgrades);
            return objectMapper.writeValueAsString(mutable);
        } catch (Exception e) {
            return normalizedJson;
        }
    }

    /** EVAL_FAILED được phép chấm lại ở lần end kế; report thật/INSUFFICIENT thì không. */
    public static boolean isRetryableFailure(String reportJson) {
        return reportJson != null && reportJson.contains("\"type\":\"" + TYPE_EVAL_FAILED + "\"");
    }

    // ── internals ──────────────────────────────────────────────────────────

    private JsonNode parseLenient(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String cleaned = raw;
        int start = cleaned.indexOf('{');
        int end = cleaned.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return null;
        }
        try {
            return objectMapper.readTree(cleaned.substring(start, end + 1));
        } catch (Exception e) {
            return null;
        }
    }

    private static boolean hasVerifiedQuote(JsonNode cat, String userCorpus) {
        List<String> texts = new ArrayList<>();
        for (String field : List.of("green_flags_vi", "red_flags_vi")) {
            JsonNode arr = cat.get(field);
            if (arr != null && arr.isArray()) {
                arr.forEach(x -> texts.add(x.asText("")));
            }
        }
        texts.add(cat.path("comment_vi").asText(""));
        for (String t : texts) {
            Matcher m = QUOTE.matcher(t);
            while (m.find()) {
                String q = normalize(m.group(1));
                if (q.length() >= MIN_QUOTE_CHARS && userCorpus.contains(q)) {
                    return true;
                }
            }
        }
        return false;
    }

    private static double applyCaps(String categoryName, double score,
                                    InterviewSessionState state, int userWords) {
        double capped = score;
        if (state != null && !state.isConcreteExampleGiven()
                && categoryName.toLowerCase(Locale.ROOT).contains("fachkompetenz")) {
            capped = Math.min(capped, NO_EXAMPLE_FACH_CAP);
        }
        if (userWords < LOW_WORDS_CAP_THRESHOLD) {
            capped = Math.min(capped, LOW_WORDS_CAP);
        }
        return capped;
    }

    private static void appendCapNote(ObjectNode cat, double original, double capped) {
        String note = "Điểm giới hạn " + formatScore(capped) + " (model chấm " + formatScore(original)
                + ") vì buổi phỏng vấn chưa có đủ ví dụ cụ thể/nội dung để chứng minh mức cao hơn.";
        String comment = cat.path("comment_vi").asText("");
        cat.put("comment_vi", comment.isBlank() ? note : comment + " " + note);
    }

    /** Chuẩn hoá để so trích dẫn: thường hoá + bỏ mọi ký tự không phải chữ/số + gộp khoảng trắng. */
    static String normalize(String s) {
        if (s == null) {
            return "";
        }
        return s.toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{Nd}]+", " ")
                .trim()
                .replaceAll("\\s+", " ");
    }

    public static int countWords(List<String> texts) {
        int n = 0;
        for (String t : texts) {
            String norm = normalize(t);
            if (!norm.isEmpty()) {
                n += norm.split(" ").length;
            }
        }
        return n;
    }

    private static String formatScore(double v) {
        return v == Math.floor(v) ? String.valueOf((int) v) : String.valueOf(v);
    }
}
