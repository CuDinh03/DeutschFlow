package com.deutschflow.grammar.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("ExamItemAiPrompt — ngữ cảnh gửi AI cho một câu đã nộp")
class ExamItemAiPromptTest {

    private static PracticeAnalysis.ItemResult only(String teilKey, Map<String, Object> teil, Map<String, String> answers) {
        return PracticeAnalysis.analyse(teilKey, teil, Map.of(), answers).items().get(0);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> firstItem(Map<String, Object> teil) {
        return (Map<String, Object>) ((List<?>) teil.get("items")).get(0);
    }

    @Test
    @DisplayName("Ngôn ngữ: vi mặc định, en/de theo tiền tố")
    void locale() {
        assertThat(ExamItemAiPrompt.locale(null)).isEqualTo("vi");
        assertThat(ExamItemAiPrompt.locale("fr")).isEqualTo("vi");
        assertThat(ExamItemAiPrompt.locale("en-US")).isEqualTo("en");
        assertThat(ExamItemAiPrompt.locale("DE")).isEqualTo("de");
        assertThat(ExamItemAiPrompt.system("de")).contains("German");
        assertThat(ExamItemAiPrompt.system("en")).contains("English");
    }

    @Test
    @DisplayName("Bài đọc dài: cắt quanh dấu hiệu trong bài, không gửi cả bài")
    void longPassageExcerptAroundEvidence() {
        String filler = "Lorem ipsum dolor sit amet. ".repeat(200);
        String text = filler + "Der Kurs beginnt am Freitag um neun Uhr." + filler;
        String out = ExamItemAiPrompt.excerpt(text, List.of("am Freitag um neun Uhr"));
        assertThat(out).contains("am Freitag um neun Uhr").startsWith("… ").endsWith(" …");
        assertThat(out.length()).isLessThanOrEqualTo(ExamItemAiPrompt.MAX_SOURCE_CHARS + 4);
        assertThat(ExamItemAiPrompt.excerpt("kurz", List.of())).isEqualTo("kurz");
    }

    @Test
    @DisplayName("Sprachbausteine: cửa sổ quanh đúng ô trống, kèm kho từ")
    void gapWindow() {
        Map<String, Object> teil = Map.of(
                "type", "GAP_WORDBANK",
                "gapped_text", "Liebe Anna, ___21___ dir für den Brief. " + "x".repeat(2000) + " Ich ___22___ morgen.",
                "word_bank", Map.of("a", "danke", "b", "komme"),
                "items", List.of(Map.of("id", "SB2-21", "gap", 21, "correct", "a")));
        var item = only("SPRACHBAUSTEINE-2", teil, Map.of("SB2-21", "b"));
        String ctx = ExamItemAiPrompt.context("SPRACHBAUSTEINE-2", teil, firstItem(teil), item);
        assertThat(ctx).contains("Lückentext (Lücke 21)", "___21___ dir für den Brief", "a) danke", "b) komme",
                "Antwort des Lernenden: b — komme [falsch]", "Richtige Antwort: a — danke");
        assertThat(ctx).doesNotContain("___22___");
    }

    @Test
    @DisplayName("Hören: lời nghe ghép từ các lượt nói, câu bỏ trống ghi rõ")
    void hoerenTranscript() {
        Map<String, Object> teil = Map.of("items", List.of(Map.of(
                "id", "HV1-41", "correct", "richtig", "question", "Der Zug fährt um acht.",
                "lead_in_de", "Sie hören eine Durchsage.",
                "audio_script", List.of(Map.of("name", "Sprecher", "text", "Der Zug nach Köln fährt heute um acht Uhr.")))));
        var item = only("HOEREN-1", teil, Map.of());
        String ctx = ExamItemAiPrompt.context("HOEREN-1", teil, firstItem(teil), item);
        assertThat(ctx).contains("Hörtext (Transkript)", "Sprecher: Der Zug nach Köln", "Situation: Sie hören eine Durchsage.",
                "Antwort des Lernenden: (keine Antwort)", "Richtige Antwort: richtig — Richtig");
        assertThat(ctx).startsWith(ExamItemAiPrompt.START).endsWith(ExamItemAiPrompt.END);
    }

    @Test
    @DisplayName("Lesen 3: chỉ gửi mẩu đã chọn và mẩu đúng, không cả 12 mẩu")
    void adsOnlyChosenAndCorrect() {
        Map<String, Object> teil = Map.of(
                "type", "MATCH_AD_X",
                "ads", Map.of("a", "Sprachkurs am Abend", "b", "Fahrrad zu verkaufen", "c", "Kochkurs für Kinder"),
                "items", List.of(Map.of("id", "LV3-11", "text", "Sie möchten abends Deutsch lernen.", "correct", "a")));
        var item = only("LESEN-3", teil, Map.of("LV3-11", "b"));
        String ctx = ExamItemAiPrompt.context("LESEN-3", teil, firstItem(teil), item);
        assertThat(ctx).contains("Anzeige a: Sprachkurs am Abend", "Anzeige b: Fahrrad zu verkaufen",
                "Frage 11: Sie möchten abends Deutsch lernen.");
        assertThat(ctx).doesNotContain("Kochkurs");
    }
}
