package com.deutschflow.grammar.service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Chấm và phân tích MỘT Teil khách quan của chế độ luyện đề (03/11/2026). Hàm thuần, không đụng DB.
 *
 * <p>Nguyên tắc owner chốt: mỗi câu phải trả lời đủ bốn ý — đáp án đúng là gì và VÌ SAO đúng, người
 * học đã chọn gì và VÌ SAO sai, sai ở đâu, đúng ra phải thế nào. Nguồn chữ, theo thứ tự ưu tiên:
 * <ol>
 *   <li>{@code explanation_vi} của câu trong đề — "vì sao đúng" (mọi đề đã duyệt đều có).</li>
 *   <li>Bảng {@code mock_exam_explanations} của Teil — "vì sao sai" riêng cho từng phương án, dấu hiệu
 *       trong bài, ý chính, loại từ cần điền, nghĩa từng lựa chọn.</li>
 *   <li>Câu ráp từ nghĩa lựa chọn + ý chính bài khi bảng trên chưa có ý riêng cho phương án đó —
 *       để không câu sai nào bị bỏ trống phần "vì sao sai".</li>
 * </ol>
 */
public final class PracticeAnalysis {

    /** Đáp án "không mẩu rao vặt nào hợp" của Leseverstehen Teil 3. */
    public static final String NONE = "x";

    public record ItemResult(String id, String label, String given, String givenText, String correct,
                             String correctText, boolean answered, boolean isCorrect, double points,
                             String whyRight, String whyWrong, String trap, List<String> evidence,
                             String need, String rule) {}

    public record UnusedOption(String key, String text, String note) {}

    public record TeilResult(String teilKey, String type, double score, double max, int correctCount,
                             int total, List<ItemResult> items, List<UnusedOption> unusedOptions) {}

    private PracticeAnalysis() {}

    @SuppressWarnings("unchecked")
    public static TeilResult analyse(String teilKey, Map<String, Object> teil, Map<String, Object> notes,
                                     Map<String, String> answers) {
        String type = teil.get("type") instanceof String t ? t : "";
        Map<String, Object> optionNotes = notes != null && notes.get("options") instanceof Map<?, ?> o
                ? (Map<String, Object>) o : Map.of();
        Map<String, Object> itemNotes = notes != null && notes.get("items") instanceof Map<?, ?> i
                ? (Map<String, Object>) i : Map.of();
        Map<String, String> pool = sharedPool(teil);
        Double teilWeight = positive(teil.get("point_per_item"));

        List<ItemResult> results = new ArrayList<>();
        Set<String> correctKeys = new HashSet<>();
        double score = 0;
        double max = 0;
        int correctCount = 0;

        if (teil.get("items") instanceof List<?> items) {
            for (Object raw : items) {
                if (!(raw instanceof Map<?, ?> m)) continue;
                Map<String, Object> item = (Map<String, Object>) m;
                String id = str(item.get("id"));
                String correct = str(item.get("correct"));
                if (id == null || correct == null) continue;
                correctKeys.add(correct.toLowerCase(Locale.ROOT));

                Double itemWeight = positive(item.get("points"));
                double weight = itemWeight != null ? itemWeight : teilWeight != null ? teilWeight : 1;
                max += weight;

                String given = answers == null ? null : blankToNull(answers.get(id));
                boolean answered = given != null;
                boolean ok = answered && given.trim().equalsIgnoreCase(correct.trim());
                if (ok) {
                    score += weight;
                    correctCount++;
                }

                Map<String, Object> note = itemNotes.get(id) instanceof Map<?, ?> n ? (Map<String, Object>) n : Map.of();
                Map<String, String> options = itemOptions(item, pool);
                String trap = null;
                String whyWrong = null;
                if (answered && !ok) {
                    Map<String, Object> wrong = wrongNote(note, given);
                    if (wrong != null) {
                        whyWrong = str(wrong.get("why_vi"));
                        trap = str(wrong.get("trap"));
                    }
                    if (whyWrong == null) {
                        whyWrong = genericWhyWrong(type, item, note, optionNotes, options, given, correct);
                    }
                }

                results.add(new ItemResult(
                        id, label(type, item, id), given, answered ? optionText(options, given) : null,
                        correct, optionText(options, correct), answered, ok, weight,
                        str(item.get("explanation_vi")), whyWrong, trap, strings(note.get("evidence")),
                        str(note.get("need_vi")), str(note.get("rule_vi"))));
            }
        }

        List<UnusedOption> unused = new ArrayList<>();
        if (!pool.isEmpty()) {
            for (Map.Entry<String, String> e : pool.entrySet()) {
                if (correctKeys.contains(e.getKey().toLowerCase(Locale.ROOT))) continue;
                Map<String, Object> on = optionNotes.get(e.getKey()) instanceof Map<?, ?> n
                        ? (Map<String, Object>) n : Map.of();
                unused.add(new UnusedOption(e.getKey(), e.getValue(), str(on.get("distractor_vi"))));
            }
        }

        return new TeilResult(teilKey, type, round2(score), round2(max), correctCount, results.size(),
                results, unused);
    }

    // ─── "vì sao sai" ráp từ dữ liệu khi chưa có ý riêng ─────────────────────

    @SuppressWarnings("unchecked")
    private static String genericWhyWrong(String type, Map<String, Object> item, Map<String, Object> note,
                                          Map<String, Object> optionNotes, Map<String, String> options,
                                          String given, String correct) {
        String g = given.trim().toLowerCase(Locale.ROOT);
        String givenText = optionText(options, g);
        Map<String, Object> on = optionNotes.get(g) instanceof Map<?, ?> n ? (Map<String, Object>) n : Map.of();
        String meaning = str(on.get("meaning_vi"));
        String gist = str(note.get("gist_vi"));
        String need = str(note.get("need_vi"));

        if ("MATCH_AD_X".equals(type)) {
            if (NONE.equals(g)) {
                return "Bạn chọn x (không mẩu nào hợp), nhưng mẩu " + correct + " đáp ứng đúng tình huống này — "
                        + "xem vì sao ở phần đáp án đúng.";
            }
            if (NONE.equalsIgnoreCase(correct.trim())) {
                return "Mẩu " + g + (meaning != null ? " (" + meaning + ")" : "")
                        + " không đáp ứng điều tình huống cần. Trong 12 mẩu không có mẩu nào phù hợp, nên đáp án là x.";
            }
        }
        if ("GAP_WORDBANK".equals(type) || "GAP_MC".equals(type)) {
            StringBuilder sb = new StringBuilder("„").append(givenText).append("“");
            sb.append(meaning != null ? " là " + meaning + "." : " không hợp chỗ trống này.");
            if (need != null) sb.append(" Chỗ này cần ").append(need).append(".");
            return sb.toString();
        }
        if (meaning != null || gist != null) {
            StringBuilder sb = new StringBuilder("„").append(givenText).append("“");
            if (meaning != null) sb.append(" nghĩa là ").append(meaning).append(".");
            if (gist != null) sb.append(" Bài này nói về ").append(gist).append(".");
            sb.append(" Hai ý không khớp nhau.");
            return sb.toString();
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> wrongNote(Map<String, Object> note, String given) {
        if (!(note.get("wrong") instanceof Map<?, ?> w)) return null;
        for (Map.Entry<?, ?> e : w.entrySet()) {
            if (String.valueOf(e.getKey()).equalsIgnoreCase(given.trim()) && e.getValue() instanceof Map<?, ?> v) {
                return (Map<String, Object>) v;
            }
        }
        return null;
    }

    // ─── lựa chọn và nhãn câu ────────────────────────────────────────────────

    /** Kho dùng chung cả Teil: tiêu đề, mẩu rao vặt hoặc hộp từ. Rỗng với dạng trắc nghiệm từng câu. */
    @SuppressWarnings("unchecked")
    static Map<String, String> sharedPool(Map<String, Object> teil) {
        for (String key : List.of("headlines", "ads", "word_bank")) {
            if (teil.get(key) instanceof Map<?, ?> m) {
                Map<String, String> out = new LinkedHashMap<>();
                ((Map<String, Object>) m).forEach((k, v) -> out.put(k, String.valueOf(v)));
                return out;
            }
        }
        return Map.of();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, String> itemOptions(Map<String, Object> item, Map<String, String> pool) {
        if (item.get("options") instanceof Map<?, ?> m) {
            Map<String, String> out = new LinkedHashMap<>();
            ((Map<String, Object>) m).forEach((k, v) -> out.put(k, String.valueOf(v)));
            return out;
        }
        return pool;
    }

    private static String optionText(Map<String, String> options, String key) {
        if (key == null) return null;
        String k = key.trim();
        if (NONE.equalsIgnoreCase(k) && !options.containsKey(k)) return "Không mẩu nào phù hợp";
        for (Map.Entry<String, String> e : options.entrySet()) {
            if (e.getKey().equalsIgnoreCase(k)) return e.getValue();
        }
        return k;
    }

    private static String label(String type, Map<String, Object> item, String id) {
        if (item.get("gap") instanceof Number n) return String.valueOf(n.intValue());
        if ("MATCH_HEADLINE".equals(type) && item.get("question") instanceof String q && !q.isBlank()) {
            return q.replaceAll("\\D+", "").isEmpty() ? q : q.replaceAll("\\D+", "");
        }
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("(\\d+)\\s*$").matcher(id);
        return m.find() ? m.group(1) : id;
    }

    // ─── tiện ích ────────────────────────────────────────────────────────────

    private static String str(Object value) {
        if (value == null) return null;
        String s = String.valueOf(value).trim();
        return s.isEmpty() ? null : s;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static List<String> strings(Object value) {
        List<String> out = new ArrayList<>();
        if (value instanceof List<?> list) {
            for (Object o : list) {
                String s = str(o);
                if (s != null) out.add(s);
            }
        }
        return out;
    }

    private static Double positive(Object value) {
        if (value instanceof Number n && n.doubleValue() > 0) return n.doubleValue();
        return null;
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
