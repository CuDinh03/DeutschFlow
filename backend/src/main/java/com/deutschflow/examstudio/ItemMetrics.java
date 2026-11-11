package com.deutschflow.examstudio;

import com.deutschflow.examstudio.ExamStudioDtos.Item;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/**
 * Đo bằng code những yếu tố độ khó ĐẾM ĐƯỢC của một câu a/b/c (Lesen Teil 2), thay cho điểm AI tự chấm.
 *
 * <p>Chạy thử với AI thật 11/11/2026: lượt AI chấm thang cho cả năm câu cùng 6/8 dù có câu chép gần nguyên
 * một câu của bài. Ba trong bốn yếu tố của thang (thiết kế §3) kiểm được bằng máy:
 * <ul>
 *   <li><b>Bằng chứng</b>: câu trích nằm trong mấy câu, mấy đoạn của bài.</li>
 *   <li><b>Diễn đạt đáp án</b>: đáp án đúng lặp lại bao nhiêu từ nội dung của bài.</li>
 *   <li><b>Phương án nhiễu</b>: nhiễu có nhắc chi tiết của bài không — không nhắc thì chắc chắn là 0 điểm;
 *       có nhắc thì độ tinh của bẫy (1 hay 2) vẫn do AI chấm.</li>
 * </ul>
 * Yếu tố thứ tư (ngôn ngữ câu hỏi) để AI chấm.
 */
public final class ItemMetrics {

    private ItemMetrics() {}

    /**
     * @param evidenceFound    câu trích có nằm nguyên văn trong bài không; không thì {@code evidence} vô nghĩa
     * @param evidence         0 = một câu, 1 = nhiều câu trong một đoạn, 2 = từ hai đoạn trở lên
     * @param evidenceParagraphs số thứ tự (từ 1) các đoạn chứa bằng chứng
     * @param phrasing         0 = đáp án gần như lặp từ của bài, 1 = diễn đạt lại, 2 = hầu như không chung từ
     * @param distractorsInText có ít nhất một phương án nhiễu nhắc chi tiết của bài
     */
    public record Measured(boolean evidenceFound, int evidence, List<Integer> evidenceParagraphs, int phrasing,
                           double answerOverlap, boolean distractorsInText) {

        public boolean multiParagraph() {
            return evidenceFound && evidenceParagraphs.size() >= 2;
        }
    }

    /** Ngưỡng tỉ lệ từ nội dung trùng bài: từ đây trở lên là "lặp từ của bài". */
    static final double REPEAT_RATIO = 0.75;
    /** Dưới ngưỡng này là "hầu như không chung từ với bài". */
    static final double INFER_RATIO = 0.40;
    /** Nhiễu trùng bài dưới ngưỡng này coi như không nhắc chi tiết của bài. */
    static final double DISTRACTOR_RATIO = 0.34;

    public static Measured measure(String context, Item item) {
        List<String> paragraphs = TextChecks.paragraphs(context == null ? "" : context);
        Set<String> textStems = stems(context);

        // Bằng chứng: tách câu trích thành từng câu rồi tìm xem nó nằm ở câu nào, đoạn nào của bài.
        Set<Integer> paras = new TreeSet<>();
        Set<String> sentences = new HashSet<>();
        boolean found = false;
        List<String> evidenceSentences = sentences(item.evidence());
        if (!evidenceSentences.isEmpty()) {
            found = true;
            for (String ev : evidenceSentences) {
                String needle = norm(ev);
                boolean hit = false;
                for (int p = 0; p < paragraphs.size() && !hit; p++) {
                    List<String> ps = sentences(paragraphs.get(p));
                    for (int s = 0; s < ps.size(); s++) {
                        if (norm(ps.get(s)).contains(needle)) {
                            paras.add(p + 1);
                            sentences.add(p + ":" + s);
                            hit = true;
                            break;
                        }
                    }
                    // Câu trích vắt qua ranh giới câu của bài (AI cắt khác chỗ): vẫn tính là thuộc đoạn này.
                    if (!hit && norm(paragraphs.get(p)).contains(needle)) {
                        paras.add(p + 1);
                        sentences.add(p + ":*" + needle.hashCode());
                        hit = true;
                    }
                }
                if (!hit) found = false;
            }
        }
        int evidence = paras.size() >= 2 ? 2 : sentences.size() >= 2 ? 1 : 0;

        Map<String, String> options = item.options() == null ? Map.of() : item.options();
        double answerOverlap = overlap(options.get(item.correct()), textStems);
        int phrasing = answerOverlap >= REPEAT_RATIO ? 0 : answerOverlap >= INFER_RATIO ? 1 : 2;

        boolean distractorsInText = false;
        for (Map.Entry<String, String> o : options.entrySet()) {
            if (o.getKey().equals(item.correct())) continue;
            if (overlap(o.getValue(), textStems) >= DISTRACTOR_RATIO) distractorsInText = true;
        }
        return new Measured(found, evidence, new ArrayList<>(paras), phrasing, answerOverlap, distractorsInText);
    }

    /**
     * Bậc cao nhất mà cấu trúc bằng chứng còn cho phép. Câu có bằng chứng gói trong một câu của bài và đáp án
     * lặp từ của bài thì không thể là Khó; không gộp hai đoạn thì không thể là Siêu khó (thiết kế §3).
     */
    public static String ceiling(Measured m) {
        if (!m.evidenceFound()) return "EXPERT";
        if (m.evidence() == 0 && m.phrasing() == 0) return "MEDIUM";
        return m.multiParagraph() ? "EXPERT" : "HARD";
    }

    /** Bậc thấp nhất: bằng chứng rải hai đoạn và đáp án phải suy ra thì không thể là Dễ. */
    public static String floor(Measured m) {
        return m.evidenceFound() && m.evidence() + m.phrasing() >= 2 ? "MEDIUM" : "EASY";
    }

    // ── Từ nội dung ─────────────────────────────────────────────────────────────────────────

    /** Từ chức năng tiếng Đức từ 4 chữ trở lên — không nói lên việc đáp án có lặp nội dung bài hay không. */
    private static final Set<String> STOP = Set.of(
            "aber", "alle", "allen", "aller", "alles", "also", "andere", "anderen", "auch", "beim", "bereits",
            "dabei", "damit", "dann", "dass", "deren", "dessen", "diese", "diesem", "diesen", "dieser", "dieses",
            "doch", "dort", "durch", "eine", "einem", "einen", "einer", "eines", "etwa", "etwas", "euch", "eure",
            "haben", "hatte", "hatten", "hier", "ihnen", "ihre", "ihrem", "ihren", "ihrer", "immer", "jede",
            "jedem", "jeden", "jeder", "jedes", "kann", "kein", "keine", "keinem", "keinen", "keiner", "können",
            "konnte", "mehr", "mein", "meine", "muss", "müssen", "nach", "nicht", "noch", "oder", "ohne", "schon",
            "sehr", "sein", "seine", "seinem", "seinen", "seiner", "sich", "sind", "soll", "sollen", "sondern",
            "über", "unter", "viel", "viele", "vielen", "wann", "waren", "weil", "wenn", "werden", "wird", "wurde",
            "wurden", "zwischen", "unser", "unsere", "wieder", "würde", "würden", "welche", "welcher");

    /** Gốc thô: chữ thường, 5 chữ đầu — đủ để "Stressbelastung"/"Stressbelastungen", "litten"/"leiden" không cần khớp. */
    static String stem(String word) {
        String w = word.toLowerCase(Locale.GERMAN);
        return w.length() > 5 ? w.substring(0, 5) : w;
    }

    static Set<String> stems(String text) {
        Set<String> out = new HashSet<>();
        if (text == null) return out;
        for (String w : TextChecks.words(text)) {
            String l = w.toLowerCase(Locale.GERMAN);
            if (l.length() >= 4 && !STOP.contains(l)) out.add(stem(l));
        }
        return out;
    }

    /** Tỉ lệ từ nội dung của {@code phrase} có gốc xuất hiện trong bài; 0 khi không có từ nội dung nào. */
    static double overlap(String phrase, Set<String> textStems) {
        Set<String> mine = stems(phrase);
        if (mine.isEmpty()) return 0;
        long hit = mine.stream().filter(textStems::contains).count();
        return (double) hit / mine.size();
    }

    static List<String> sentences(String text) {
        List<String> out = new ArrayList<>();
        if (text == null) return out;
        for (String s : text.replace("…", " ").split("(?<=[.!?])\\s+")) {
            String t = s.trim();
            if (t.length() >= 12) out.add(t);
        }
        return out;
    }

    static String norm(String s) {
        return s.toLowerCase(Locale.GERMAN).replaceAll("[*„“”\"»«‚‘’']", "").replaceAll("[\\s\\u00a0]+", " ")
                .replaceAll("[.!?]+$", "").trim();
    }
}
