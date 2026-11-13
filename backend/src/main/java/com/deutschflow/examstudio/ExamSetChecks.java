package com.deutschflow.examstudio;

import com.deutschflow.examstudio.ExamStudioDtos.Check;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Kiểm CẤP BỘ ĐỀ (phần thuần): sau khi mọi Teil của một lượt đã qua tự kiểm riêng, xem cả bộ có đứng được như một
 * đề không và có "độc nhất" không — owner chốt 12/11/2026: hai bộ đề không trùng bài, không trùng đáp án.
 *
 * <ul>
 *   <li>Đỏ (chặn duyệt cả bộ): hai Teil trong bộ trùng chủ đề; một Teil giống quá {@value #TEXT_RED} một Teil đã có
 *       (kho Teil, bộ khác đang chờ duyệt, đề viết tay — ở BẤT KỲ ô nào cùng cấp); một câu trùng hẳn câu đã có.</li>
 *   <li>Vàng (owner nên xem): hai Teil trong bộ dùng chung nhiều chữ; chuỗi đáp án của một Teil trùng chuỗi của Teil
 *       cùng ô ở bộ khác; một chữ đáp án chiếm quá nhiều; độ khó đo được lệch hồ sơ đã chọn.</li>
 * </ul>
 */
final class ExamSetChecks {

    private ExamSetChecks() {}

    static final int GRAM = ExamDedupService.TEIL_GRAM;
    static final double TEXT_RED = 0.30;
    static final double INTERNAL_YELLOW = 0.15;
    static final double LETTER_SHARE_YELLOW = 0.45;
    static final int LETTER_MIN_ITEMS = 15;
    static final double DIFFICULTY_OFF_YELLOW = 0.25;

    /** Một Teil của bộ đang kiểm. {@code cell} = "SECTION#teil". */
    record TeilDoc(String cell, String label, String theme, String text, List<String> itemCores, String answerKey,
                   Map<String, Integer> target, Map<String, Integer> measured) {}

    /** Một Teil đã có ở nơi khác để so. */
    record Other(String label, String cell, String text, List<String> itemCores, String answerKey) {}

    static List<Check> run(List<TeilDoc> set, List<Other> corpus) {
        List<Check> out = new ArrayList<>();
        out.add(themes(set));
        out.add(internalOverlap(set));
        out.add(uniqueText(set, corpus));
        out.add(uniqueItems(set, corpus));
        out.add(answerKeys(set, corpus));
        out.add(letters(set));
        out.add(difficulty(set));
        return out;
    }

    static boolean hasRed(List<Check> checks) {
        return checks.stream().anyMatch(c -> "RED".equals(c.light()));
    }

    private static Check themes(List<TeilDoc> set) {
        Map<String, String> seen = new LinkedHashMap<>();
        List<String> dup = new ArrayList<>();
        for (TeilDoc t : set) {
            // Teil nhiều văn bản ngắn mang nhiều chủ đề ("A / B / C"): không chủ đề nào được lặp ở Teil khác.
            for (String th : new java.util.LinkedHashSet<>(ExamSetPlanner.split(t.theme()))) {
                String prev = seen.putIfAbsent(th.toLowerCase(Locale.GERMAN), t.label());
                if (prev != null) dup.add(prev + " và " + t.label() + " cùng chủ đề „" + th + "“");
            }
        }
        return new Check("SET_THEMES", "Mỗi Teil một chủ đề", dup.isEmpty() ? "GREEN" : "RED",
                dup.isEmpty() ? null : String.join("; ", dup));
    }

    /**
     * Teil nhiều văn bản ngắn (Lesen Teil 1): các đoạn phải trải trên nhiều chủ đề (owner chốt 13/11/2026). Đủ
     * {@link ExamSetPlanner#MIX_THEMES} ⇒ xanh; {@link ExamSetPlanner#MIX_THEMES_MIN} ⇒ vàng; ít hơn ⇒ đỏ.
     */
    static Check themeMix(String label, String theme) {
        int n = new HashSet<>(ExamSetPlanner.split(theme)).size();
        String light = n >= ExamSetPlanner.MIX_THEMES ? "GREEN" : n >= ExamSetPlanner.MIX_THEMES_MIN ? "YELLOW" : "RED";
        return new Check("SET_THEME_MIX", label + ": các đoạn trải trên nhiều chủ đề", light,
                "GREEN".equals(light) ? null : "Chỉ có " + n + " chủ đề (" + (theme == null ? "—" : theme) + "); cần "
                        + ExamSetPlanner.MIX_THEMES + ".");
    }

    private static Check internalOverlap(List<TeilDoc> set) {
        List<String> notes = new ArrayList<>();
        double worst = 0;
        for (int i = 0; i < set.size(); i++) {
            Set<Long> a = hashes(set.get(i).text());
            for (int j = i + 1; j < set.size(); j++) {
                double s = similarity(set.get(i).text(), a, set.get(j).text(), hashes(set.get(j).text()));
                worst = Math.max(worst, s);
                if (s >= INTERNAL_YELLOW) notes.add(set.get(i).label() + " ↔ " + set.get(j).label() + ": " + pct(s));
            }
        }
        return new Check("SET_INTERNAL", "Các Teil trong bộ không lặp chữ của nhau",
                worst >= TEXT_RED ? "RED" : notes.isEmpty() ? "GREEN" : "YELLOW",
                notes.isEmpty() ? null : String.join("; ", notes));
    }

    private static Check uniqueText(List<TeilDoc> set, List<Other> corpus) {
        List<String> red = new ArrayList<>();
        double top = 0;
        String topNote = null;
        Map<Other, Set<Long>> cache = new java.util.IdentityHashMap<>();
        for (TeilDoc t : set) {
            Set<Long> mine = hashes(t.text());
            for (Other o : corpus) {
                double s = similarity(t.text(), mine, o.text(), cache.computeIfAbsent(o, x -> hashes(x.text())));
                if (s > top) {
                    top = s;
                    topNote = t.label() + " giống " + pct(s) + " với " + o.label();
                }
                if (s >= TEXT_RED) red.add(t.label() + " giống " + pct(s) + " với " + o.label());
            }
        }
        String detail = !red.isEmpty() ? String.join("; ", red)
                : corpus.isEmpty() ? "Chưa có Teil nào khác để so." : "Giống nhất: " + (topNote == null ? "0 %" : topNote) + ".";
        return new Check("SET_UNIQUE_TEXT", "Bài không trùng bộ khác", red.isEmpty() ? "GREEN" : "RED", detail);
    }

    private static Check uniqueItems(List<TeilDoc> set, List<Other> corpus) {
        Map<String, String> known = new LinkedHashMap<>();
        for (Other o : corpus) for (String c : o.itemCores()) if (!c.isBlank()) known.putIfAbsent(c, o.label());
        List<String> dup = new ArrayList<>();
        Set<String> inSet = new HashSet<>();
        for (TeilDoc t : set) {
            for (String c : t.itemCores()) {
                if (c.isBlank()) continue;
                if (known.containsKey(c)) dup.add(t.label() + " có câu trùng " + known.get(c));
                else if (!inSet.add(c)) dup.add(t.label() + " có câu lặp lại trong chính bộ này");
            }
        }
        return new Check("SET_UNIQUE_ITEMS", "Câu hỏi và đáp án không trùng bộ khác", dup.isEmpty() ? "GREEN" : "RED",
                dup.isEmpty() ? null : String.join("; ", dup.stream().distinct().limit(8).toList()));
    }

    private static Check answerKeys(List<TeilDoc> set, List<Other> corpus) {
        List<String> same = new ArrayList<>();
        for (TeilDoc t : set) {
            if (t.answerKey() == null || t.answerKey().length() < 5) continue;
            // Teil richtig/falsch 5 câu (Hören 1 và 3) chỉ có vài chục chuỗi đáp án cân được: trùng chuỗi với một
            // đề khác là chuyện thường, không phải dấu hiệu chép đề. Teil 10 câu (Hören 2) vẫn so.
            if (shortTrueFalseKey(t.answerKey())) continue;
            for (Other o : corpus) {
                if (t.cell().equals(o.cell()) && t.answerKey().equalsIgnoreCase(o.answerKey())) {
                    same.add(t.label() + " có chuỗi đáp án " + t.answerKey() + " giống " + o.label());
                    break;
                }
            }
        }
        return new Check("SET_ANSWER_KEYS", "Chuỗi đáp án không lặp lại bộ khác", same.isEmpty() ? "GREEN" : "YELLOW",
                same.isEmpty() ? null : String.join("; ", same));
    }

    /** Chuỗi đáp án chỉ gồm richtig/falsch và không quá 5 câu. */
    static boolean shortTrueFalseKey(String key) {
        String k = key == null ? "" : key.toLowerCase(Locale.ROOT);
        if (!k.matches("(richtig|falsch)+")) return false;
        return k.replace("richtig", "r").replace("falsch", "f").length() <= 5;
    }

    /** Chỉ tính các Teil trắc nghiệm a/b/c (chuỗi đáp án chỉ gồm a, b, c). */
    private static Check letters(List<TeilDoc> set) {
        Map<Character, Integer> count = new LinkedHashMap<>();
        int total = 0;
        for (TeilDoc t : set) {
            String k = t.answerKey() == null ? "" : t.answerKey().toLowerCase(Locale.ROOT);
            if (k.isEmpty() || !k.matches("[abc]+")) continue;
            for (char ch : k.toCharArray()) count.merge(ch, 1, Integer::sum);
            total += k.length();
        }
        String light = "GREEN";
        String detail = null;
        if (total >= LETTER_MIN_ITEMS) {
            for (Map.Entry<Character, Integer> e : count.entrySet()) {
                if (e.getValue() > total * LETTER_SHARE_YELLOW) {
                    light = "YELLOW";
                    detail = "Đáp án " + e.getKey() + " chiếm " + e.getValue() + "/" + total + " câu a/b/c của cả bộ.";
                }
            }
        }
        return new Check("SET_LETTERS", "Đáp án a/b/c rải đều trên cả bộ", light, detail);
    }

    private static Check difficulty(List<TeilDoc> set) {
        Map<String, Integer> target = new LinkedHashMap<>();
        Map<String, Integer> measured = new LinkedHashMap<>();
        for (String lv : TeilSpec.LEVELS) {
            target.put(lv, 0);
            measured.put(lv, 0);
        }
        for (TeilDoc t : set) {
            if (t.target() != null) t.target().forEach((k, v) -> target.merge(k, v == null ? 0 : v, Integer::sum));
            if (t.measured() != null) t.measured().forEach((k, v) -> measured.merge(k, v == null ? 0 : v, Integer::sum));
        }
        int total = target.values().stream().mapToInt(Integer::intValue).sum();
        int counted = measured.values().stream().mapToInt(Integer::intValue).sum();
        if (total == 0 || counted == 0) return new Check("SET_DIFFICULTY", "Độ khó cả bộ theo hồ sơ", "GREEN", null);
        int off = 0;
        for (String lv : TeilSpec.LEVELS) off += Math.abs(target.get(lv) - measured.get(lv));
        double share = off / 2.0 / total;
        String detail = "Giao " + join(target) + " · đo được " + join(measured) + " (Dễ-Vừa-Khó-Siêu khó).";
        return new Check("SET_DIFFICULTY", "Độ khó cả bộ theo hồ sơ", share > DIFFICULTY_OFF_YELLOW ? "YELLOW" : "GREEN", detail);
    }

    private static String join(Map<String, Integer> m) {
        return TeilSpec.LEVELS.stream().map(l -> String.valueOf(m.getOrDefault(l, 0))).reduce((a, b) -> a + "-" + b).orElse("");
    }

    private static Set<Long> hashes(String text) {
        return new HashSet<>(TextChecks.shingleHashes(text == null ? "" : text, GRAM));
    }

    /** Chiều cao hơn của hai chiều chứa nhau, như {@link ExamDedupService#mostSimilar}. */
    private static double similarity(String a, Set<Long> aHashes, String b, Set<Long> bHashes) {
        if (aHashes.isEmpty() || bHashes.isEmpty()) return 0;
        return Math.max(TextChecks.containment(a, bHashes, GRAM), TextChecks.containment(b, aHashes, GRAM));
    }

    private static String pct(double s) {
        return Math.round(s * 100) + " %";
    }
}
