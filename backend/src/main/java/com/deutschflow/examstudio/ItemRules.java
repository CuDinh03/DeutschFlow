package com.deutschflow.examstudio;

import com.deutschflow.examstudio.ExamStudioDtos.Scores;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Luật thuần cho câu hỏi: quy điểm thang 4 yếu tố ra bậc, và gán chữ a/b/c cho đáp án sao cho đều.
 *
 * <p>Thang (thiết kế §3): diễn đạt đáp án, vị trí bằng chứng, phương án nhiễu, ngôn ngữ câu hỏi — mỗi yếu tố
 * 0–2. Tổng 0–1 Dễ, 2–4 Vừa, 5–6 Khó, 7–8 Siêu khó. Siêu khó còn phải gộp ≥ 2 đoạn VÀ có một nhiễu
 * „đúng một nửa"; thiếu một trong hai thì chỉ là Khó.
 */
public final class ItemRules {

    private ItemRules() {}

    public static final List<String> LETTERS = List.of("a", "b", "c");

    public static String levelOf(Scores s, boolean multiParagraph, boolean halfTrueDistractor) {
        int t = clamp(s.phrasing()) + clamp(s.evidence()) + clamp(s.distractors()) + clamp(s.language());
        if (t <= 1) return "EASY";
        if (t <= 4) return "MEDIUM";
        if (t <= 6) return "HARD";
        return multiParagraph && halfTrueDistractor ? "EXPERT" : "HARD";
    }

    static int clamp(int v) {
        return Math.max(0, Math.min(2, v));
    }

    public static int rank(String level) {
        return TeilSpec.LEVELS.indexOf(level);
    }

    private static final Map<String, String> LABEL = Map.of(
            "EASY", "Dễ", "MEDIUM", "Vừa", "HARD", "Khó", "EXPERT", "Siêu khó");

    public static String label(String level) {
        return LABEL.getOrDefault(level, level);
    }

    /** Gợi ý tiếng Việt khi bậc đo được lệch bậc giao; null khi khớp. */
    public static String hint(String target, String measured, Scores s, boolean multiParagraph,
                              boolean halfTrue) {
        if (target == null || target.equals(measured)) return null;
        String head = "Đang là " + label(measured) + ", giao " + label(target) + ". ";
        if (rank(measured) < rank(target)) {
            List<String> ways = new ArrayList<>();
            if (s.phrasing() < 2) ways.add("diễn đạt đáp án bằng từ khác hẳn bài, phải suy ra");
            if (s.evidence() < 2 || ("EXPERT".equals(target) && !multiParagraph)) ways.add("đặt bằng chứng rải ở 2 đoạn");
            if (s.distractors() < 2 || ("EXPERT".equals(target) && !halfTrue)) ways.add("dùng nhiễu nhắc chi tiết có thật nhưng sai một vế");
            if (ways.isEmpty()) ways.add("dùng cấu trúc câu hỏi khó hơn (Passiv, Konj. II, phủ định)");
            return head + "Muốn khó hơn: " + String.join("; ", ways) + ".";
        }
        return head + "Muốn dễ hơn: lấy đáp án gần lời bài, bằng chứng trong một câu, nhiễu sai rõ.";
    }

    /**
     * Chọn chữ cho đáp án đúng ở vị trí {@code pos} khi các vị trí khác đã có chữ (null = chưa có):
     * ít dùng nhất trước, không để 3 câu liền cùng chữ, hoà thì bốc theo seed.
     */
    public static String chooseLetter(List<String> lettersByPos, int pos, Random rnd) {
        Map<String, Integer> count = new LinkedHashMap<>();
        for (String l : LETTERS) count.put(l, 0);
        for (int i = 0; i < lettersByPos.size(); i++) {
            String l = lettersByPos.get(i);
            if (i != pos && l != null) count.merge(l, 1, Integer::sum);
        }
        List<String> candidates = new ArrayList<>(LETTERS);
        java.util.Collections.shuffle(candidates, rnd);
        candidates.sort(Comparator.comparingInt(count::get));
        for (String l : candidates) {
            if (!makesTriple(lettersByPos, pos, l)) return l;
        }
        return candidates.get(0);
    }

    static boolean makesTriple(List<String> letters, int pos, String l) {
        List<String> tmp = new ArrayList<>(letters);
        tmp.set(pos, l);
        for (int i = Math.max(0, pos - 2); i <= pos && i + 2 < tmp.size(); i++) {
            if (l.equals(tmp.get(i)) && l.equals(tmp.get(i + 1)) && l.equals(tmp.get(i + 2))) return true;
        }
        return false;
    }

    /** Một phương án do AI trả, chưa có chữ. */
    public record RawOption(String text, boolean correct, String trap) {}

    /** Kết quả gán chữ: map chữ → nội dung, chữ đúng, bẫy theo chữ, lời giải đã thay {1}{2}{3}. */
    public record Lettered(Map<String, String> options, String correct, List<ExamStudioDtos.Trap> traps,
                           String explanation) {}

    /**
     * Đặt đáp án đúng vào {@code correctLetter}, các nhiễu lấp chữ còn lại theo thứ tự AI trả. Lời giải
     * của AI tham chiếu phương án bằng {1}/{2}/{3} (thứ tự AI trả) — thay bằng chữ thật.
     */
    public static Lettered letter(List<RawOption> raw, String correctLetter, String explanationTemplate) {
        int correctIdx = -1;
        for (int i = 0; i < raw.size(); i++) if (raw.get(i).correct()) correctIdx = i;
        List<String> free = new ArrayList<>(LETTERS);
        free.remove(correctLetter);
        String[] letterOf = new String[raw.size()];
        int f = 0;
        for (int i = 0; i < raw.size(); i++) letterOf[i] = i == correctIdx ? correctLetter : free.get(f++);
        Map<String, String> options = new LinkedHashMap<>();
        for (String l : LETTERS) {
            for (int i = 0; i < raw.size(); i++) if (letterOf[i].equals(l)) options.put(l, raw.get(i).text());
        }
        List<ExamStudioDtos.Trap> traps = new ArrayList<>();
        for (String l : LETTERS) {
            for (int i = 0; i < raw.size(); i++) {
                if (letterOf[i].equals(l) && i != correctIdx && raw.get(i).trap() != null
                        && !raw.get(i).trap().isBlank()) {
                    traps.add(new ExamStudioDtos.Trap(l, raw.get(i).trap()));
                }
            }
        }
        String expl = explanationTemplate == null ? "" : explanationTemplate;
        for (int i = 0; i < raw.size(); i++) expl = expl.replace("{" + (i + 1) + "}", letterOf[i]);
        return new Lettered(options, correctLetter, traps, expl);
    }

    /** Danh sách bậc cho từng vị trí câu theo ma trận (Dễ trước, rồi Vừa, Khó, Siêu khó). */
    public static List<String> slots(Map<String, Integer> plan, int itemCount) {
        List<String> out = new ArrayList<>();
        for (String level : TeilSpec.LEVELS) {
            int n = plan == null ? 0 : Math.max(0, plan.getOrDefault(level, 0));
            for (int i = 0; i < n && out.size() < itemCount; i++) out.add(level);
        }
        while (out.size() < itemCount) out.add("MEDIUM");
        return out;
    }
}
