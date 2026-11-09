package com.deutschflow.examstudio;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Khuôn một Teil mà Xưởng đề làm được. Đợt 1 chỉ có telc · B1 · LESEN · Teil 2 — số đo lấy từ bản thử
 * „Schlaf" (plans/2026-11-07-ban-thu-de-lesen-teil2-schlaf.md) và đề thật (phân tích 17/09: ~300–450 từ,
 * 5 câu Satzanfang + 3 đuôi, thứ tự câu không theo bài).
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
            "TELC", "B1", "LESEN", 2, "MULTIPLE_CHOICE", 5, 6, "LV2-", 5, 300, 450, 0.06,
            "Lesen Sie zuerst den Text und lösen Sie dann die Aufgaben 6–10. Welche Lösung (a, b oder c) ist "
                    + "jeweils richtig? Beachten Sie: Die Reihenfolge der Aufgaben folgt nicht immer der "
                    + "Reihenfolge des Textes.",
            "Đọc bài rồi làm câu 6–10: mỗi câu là một mở đầu câu, chọn đuôi đúng (a, b hoặc c). Thứ tự câu "
                    + "hỏi KHÔNG theo thứ tự bài.");

    private static final List<TeilSpec> ALL = List.of(TELC_B1_LESEN_2);

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
