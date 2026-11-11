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
        double pointsPerItem,
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

    // ── Đợt 3: các Teil soạn theo tình huống (owner chốt 09/11: không lấy từ báo) ─────────────────
    // minWords/maxWords: Lesen T3 = mỗi mẩu rao vặt; Sprachbausteine = cả bức thư; Schreiben = thư kích thích.

    static final TeilSpec TELC_B1_LESEN_3 = new TeilSpec(
            "TELC", "B1", "LESEN", 3, "MATCH_AD_X", 10, 11, "LV3-", 2.5, 12, 15, 45, 0.06,
            "Lesen Sie zuerst die zehn Situationen (11–20) und dann die zwölf Anzeigen (a–l). Welche Anzeige passt "
                    + "zu welcher Situation? Jede Anzeige kann nur einmal verwendet werden; die Anzeige aus dem Beispiel "
                    + "dürfen Sie noch einmal verwenden. Passt keine Anzeige, wählen Sie x.",
            "Đọc 10 tình huống rồi 12 mẩu rao vặt a–l. Mỗi mẩu dùng một lần; mẩu của ví dụ được dùng lại. Không mẩu "
                    + "nào hợp thì chọn x — đề thật luôn có hai tình huống như vậy.");

    static final TeilSpec TELC_B1_SB_1 = new TeilSpec(
            "TELC", "B1", "SPRACHBAUSTEINE", 1, "GAP_MC", 10, 21, "SB1-", 1.5, 1, 150, 230, 0.06,
            "Lesen Sie den Text und kreuzen Sie für jede Lücke (21–30) das richtige Wort (a, b oder c) an.",
            "Đọc thư và chọn từ đúng (a, b hoặc c) cho mỗi ô trống 21–30. Ba lựa chọn thường là ba dạng của cùng một "
                    + "từ hoặc ba từ nối cùng loại.");

    static final TeilSpec TELC_B1_SB_2 = new TeilSpec(
            "TELC", "B1", "SPRACHBAUSTEINE", 2, "GAP_WORDBANK", 10, 31, "SB2-", 1.5, 1, 150, 230, 0.06,
            "Lesen Sie die Anzeige und den Brief. Welches Wort aus dem Kasten (a–o) passt in die Lücken 31–40? Jedes "
                    + "Wort kann nur einmal verwendet werden. Nicht alle Wörter passen in den Text.",
            "Đọc mẩu tin rồi bức thư trả lời. Chọn từ trong hộp a–o cho mỗi ô 31–40; mỗi từ dùng một lần, năm từ thừa. "
                    + "Hộp gồm từ nối, giới từ, động từ khuyết thiếu — soi trật tự động từ và cặp từ dễ lẫn.");

    static final TeilSpec TELC_B1_SCHREIBEN = new TeilSpec(
            "TELC", "B1", "SCHREIBEN", 1, "WRITE_EMAIL", 0, 0, "SA-", 0, 1, 70, 130, 0.06,
            "Antworten Sie auf die E-Mail. Schreiben Sie zu allen vier Punkten und überlegen Sie sich eine passende "
                    + "Reihenfolge der Punkte. Vergessen Sie nicht Anrede und Gruß.",
            "Viết một E-Mail xưng „du“ trả lời bạn: đủ bốn ý dưới đây, tự sắp thứ tự cho hợp lý, có lời chào đầu và "
                    + "cuối. Bốn ý in không theo thứ tự — như tờ đề thật. Gợi ý độ dài: 120–180 từ.");

    // ── Đợt 4: telc Deutsch A2 / Start Deutsch 2 (cấu trúc theo Übungstest 1 chính thức của telc, 2024) ──
    // Lesen 3 Teil × 5 câu (1 điểm), Schreiben Teil 1 = form 5 ô (1 điểm), Teil 2 = 3 trong 4 ý, ~40 từ (10 điểm).
    // Hören (3 Teil × 5) làm cùng đợt audio.

    static final TeilSpec TELC_A2_LESEN_1 = new TeilSpec(
            "TELC", "A2", "LESEN", 1, "MC_INFO", 5, 1, "LV1-", 1, 1, 40, 140, 0.08,
            "Lesen Sie die Aufgaben 1–5 und die Information. Welche Lösung passt? Kreuzen Sie an: a, b oder c.",
            "Đọc bảng thông tin (vd. bảng chỉ dẫn trong toà nhà, trang web) và 5 tình huống; chọn a, b hoặc c.");

    static final TeilSpec TELC_A2_LESEN_2 = new TeilSpec(
            "TELC", "A2", "LESEN", 2, "TRUE_FALSE", 5, 6, "LV2-", 1, 1, 100, 190, 0.08,
            "Lesen Sie den Text und die Aufgaben 6–10. Sind die Aussagen richtig oder falsch? Kreuzen Sie an.",
            "Đọc bài (E-Mail, bài báo ngắn) và quyết định 5 câu 6–10 đúng hay sai.");

    static final TeilSpec TELC_A2_LESEN_3 = new TeilSpec(
            "TELC", "A2", "LESEN", 3, "MATCH_AD_X", 5, 11, "LV3-", 1, 8, 10, 35, 0.08,
            "Lesen Sie die Anzeigen a–h und die Aufgaben 11–15. Welche Anzeige passt zu welcher Situation? Für eine "
                    + "Aufgabe gibt es keine Lösung. Schreiben Sie dann x.",
            "Đọc 8 mẩu rao vặt a–h và 5 tình huống 11–15; chọn mẩu hợp. Có một tình huống không mẩu nào hợp — chọn x.");

    static final TeilSpec TELC_A2_SCHREIBEN_1 = new TeilSpec(
            "TELC", "A2", "SCHREIBEN", 1, "FILL_FORM", 5, 1, "SA1-", 1, 1, 60, 140, 0.08,
            "Lesen Sie den Text. Schreiben Sie die fünf fehlenden Informationen in das Formular.",
            "Đọc đoạn văn rồi điền 5 thông tin còn thiếu vào form. Sai chính tả nhẹ vẫn tính, nhưng số phải đúng.");

    static final TeilSpec TELC_A2_SCHREIBEN_2 = new TeilSpec(
            "TELC", "A2", "SCHREIBEN", 2, "WRITE_NOTE", 0, 0, "SA2-", 0, 1, 20, 70, 0.08,
            "Hier finden Sie vier Punkte. Wählen Sie drei aus. Schreiben Sie zu jedem dieser drei Punkte ein bis zwei "
                    + "Sätze. Schreiben Sie ca. 40 Wörter. Vergessen Sie nicht Anrede und Gruß.",
            "Có 4 ý, chọn 3; mỗi ý viết 1–2 câu, khoảng 40 từ, có lời chào đầu và cuối.");

    /** Chữ của 12 mẩu rao vặt Lesen Teil 3. */
    public static final List<String> AD_LETTERS = List.of("a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l");
    /** Chữ của 15 từ trong hộp Sprachbausteine Teil 2. */
    public static final List<String> BANK_LETTERS =
            List.of("a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o");

    private static final List<TeilSpec> ALL = List.of(TELC_B1_LESEN_1, TELC_B1_LESEN_2, TELC_B1_LESEN_3,
            TELC_B1_SB_1, TELC_B1_SB_2, TELC_B1_SCHREIBEN, TELC_A2_LESEN_1, TELC_A2_LESEN_2, TELC_A2_LESEN_3,
            TELC_A2_SCHREIBEN_1, TELC_A2_SCHREIBEN_2);

    /** Teil soạn theo tình huống: không có bước nguồn báo, dùng ô "Tình huống". */
    public boolean situational() {
        return !headlines() && !"MULTIPLE_CHOICE".equals(teilType);
    }

    /** Số câu "không mẩu nào hợp" (x) của Teil rao vặt: B1 = 2, A2 = 1. */
    public int xCount() {
        return "A2".equals(cefrLevel) ? 1 : 2;
    }

    /** Số ví dụ in trước câu hỏi của Teil rao vặt: B1 = 2 (01 ghép được, 02 = x), A2 = 1. */
    public int exampleCount() {
        return "A2".equals(cefrLevel) ? 1 : 2;
    }

    /** Chữ các mẩu rao vặt của Teil này (B1 a–l, A2 a–h). */
    public List<String> adLetters() {
        return AD_LETTERS.subList(0, Math.min(textCount, AD_LETTERS.size()));
    }

    /** Kiểu {@code type} ghi vào {@code sections_json} (khác kiểu nội bộ ở vài Teil A2). */
    public String outputType() {
        return switch (teilType) {
            case "MC_INFO" -> "MULTIPLE_CHOICE";
            default -> teilType;
        };
    }

    /** Phần Viết: không có câu hỏi trắc nghiệm, không có ma trận độ khó. */
    public boolean writing() {
        return "WRITE_EMAIL".equals(teilType) || "WRITE_NOTE".equals(teilType);
    }

    /** Điểm mỗi câu đúng khuôn seed: 5 thay vì 5.0, 2.5 giữ nguyên. */
    public Number points() {
        return pointsPerItem == Math.rint(pointsPerItem) ? (Number) (int) pointsPerItem : (Number) pointsPerItem;
    }

    public boolean headlines() {
        return "MATCH_HEADLINE".equals(teilType);
    }

    /** Chữ hợp lệ cho đáp án của Teil này. */
    public List<String> answerLetters() {
        return switch (teilType) {
            case "MATCH_HEADLINE" -> HEADLINE_LETTERS;
            case "MATCH_AD_X" -> java.util.stream.Stream.concat(adLetters().stream(), java.util.stream.Stream.of("x")).toList();
            case "TRUE_FALSE" -> List.of("richtig", "falsch");
            case "FILL_FORM" -> List.of();
            case "GAP_WORDBANK" -> BANK_LETTERS;
            default -> ItemRules.LETTERS;
        };
    }

    /** Mọi Teil Xưởng đề làm được của một kỳ thi + cấp, theo thứ tự trong đề. */
    public static List<TeilSpec> forExam(String format, String level) {
        if (format == null || level == null) return List.of();
        return ALL.stream().filter(s -> s.examFormat.equalsIgnoreCase(format.trim())
                && s.cefrLevel.equalsIgnoreCase(level.trim())).toList();
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
