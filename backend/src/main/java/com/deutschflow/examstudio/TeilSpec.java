package com.deutschflow.examstudio;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Khuôn một Teil mà Xưởng đề làm được.
 * <ul>
 *   <li>telc · B1 · LESEN · Teil 2 (đợt 1): một bài báo ~300–450 từ, 5 câu Satzanfang + 3 đuôi, thứ tự câu không
 *       theo bài — số đo từ bản thử „Schlaf" và đề thật (phân tích 17/09).</li>
 *   <li>telc · B1 · LESEN · Teil 1 (đợt 2): 5 văn bản ngắn 55–110 từ, 10 tiêu đề a–j, mỗi tiêu đề dùng một lần;
 *       mỗi văn bản một tiêu đề đúng + một tiêu đề nhiễu „gần đúng" (phân tích 17/09, N6).</li>
 * </ul>
 * {@code minWords}/{@code maxWords} là cho MỖI văn bản khi {@code textCount > 1}.
 */
public record TeilSpec(
        String examFormat,
        String cefrLevel,
        String section,
        int teil,
        String teilType,
        int itemCount,
        int firstItemNumber,
        String itemIdPrefix,
        int pointsPerItem,
        int textCount,
        int minWords,
        int maxWords,
        double maxAboveLevelRatio,
        String instructionDe,
        String instructionVi) {

    public static final List<String> LEVELS = List.of("EASY", "MEDIUM", "HARD", "EXPERT");

    public static final List<String> CHECKLIST_KEYS = List.of(
            "LEVEL", "FORMAT", "SINGLE_ANSWER", "NEUTRAL", "FACTS_MATCH", "NO_COPY", "QUELLE", "EXPLANATION");

    /** Chủ đề trung lập owner chốt 07/11 (tên Đức để đưa thẳng vào prompt). */
    public static final List<String> NEUTRAL_THEMES = List.of(
            "Arbeit", "Wohnen", "Gesundheit", "Bildung", "Verkehr", "Reisen", "Einkaufen",
            "Technik im Alltag", "Sport", "Essen und Trinken");

    /** Đoạn trùng nguồn từ bấy nhiêu từ liên tiếp trở lên là chép — chặn duyệt. */
    public static final int OVERLAP_LIMIT = 6;

    static final TeilSpec TELC_B1_LESEN_2 = new TeilSpec(
            "TELC", "B1", "LESEN", 2, "MULTIPLE_CHOICE", 5, 6, "LV2-", 5, 1, 300, 450, 0.06,
            "Lesen Sie zuerst den Text und lösen Sie dann die Aufgaben 6–10. Welche Lösung (a, b oder c) ist "
                    + "jeweils richtig? Beachten Sie: Die Reihenfolge der Aufgaben folgt nicht immer der "
                    + "Reihenfolge des Textes.",
            "Đọc bài rồi làm câu 6–10: mỗi câu là một mở đầu câu, chọn đuôi đúng (a, b hoặc c). Thứ tự câu "
                    + "hỏi KHÔNG theo thứ tự bài.");

    static final TeilSpec TELC_B1_LESEN_1 = new TeilSpec(
            "TELC", "B1", "LESEN", 1, "MATCH_HEADLINE", 5, 1, "LV1-", 5, 5, 55, 110, 0.06,
            "Lesen Sie zuerst die fünf Texte (1–5) und dann die zehn Überschriften (a–j). Welche Überschrift "
                    + "passt am besten zu welchem Text? Jede Überschrift kann nur einmal verwendet werden.",
            "Đọc 5 văn bản rồi 10 tiêu đề a–j. Chọn cho mỗi văn bản tiêu đề hợp nhất; mỗi tiêu đề chỉ dùng một lần. "
                    + "Năm tiêu đề thừa đều „gần đúng“ — hãy soi chi tiết.");

    /** Chữ của 10 tiêu đề Lesen Teil 1. */
    public static final List<String> HEADLINE_LETTERS = List.of("a", "b", "c", "d", "e", "f", "g", "h", "i", "j");

    private static final List<TeilSpec> ALL = List.of(TELC_B1_LESEN_1, TELC_B1_LESEN_2);

    public boolean headlines() {
        return "MATCH_HEADLINE".equals(teilType);
    }

    /** Chữ hợp lệ cho đáp án của Teil này. */
    public List<String> answerLetters() {
        return headlines() ? HEADLINE_LETTERS : ItemRules.LETTERS;
    }

    public static Optional<TeilSpec> find(String format, String level, String section, Integer teil) {
        if (format == null || level == null || section == null || teil == null) return Optional.empty();
        return ALL.stream()
                .filter(s -> s.examFormat.equalsIgnoreCase(format.trim())
                        && s.cefrLevel.equalsIgnoreCase(level.trim())
                        && s.section.equalsIgnoreCase(section.trim())
                        && s.teil == teil)
                .findFirst();
    }

    public String itemId(int slot) {
        return itemIdPrefix + (firstItemNumber + slot);
    }

    public static boolean isLevel(String v) {
        return v != null && LEVELS.contains(v.toUpperCase(Locale.ROOT));
    }
}
