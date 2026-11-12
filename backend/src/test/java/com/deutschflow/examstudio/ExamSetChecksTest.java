package com.deutschflow.examstudio;

import com.deutschflow.examstudio.ExamSetChecks.Other;
import com.deutschflow.examstudio.ExamSetChecks.TeilDoc;
import com.deutschflow.examstudio.ExamStudioDtos.Check;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Xưởng đề — kiểm cấp bộ đề: chủ đề, độc nhất, đáp án, độ khó")
class ExamSetChecksTest {

    private static final String WOHNEN = "Viele Menschen in großen Städten suchen lange nach einer bezahlbaren Wohnung. "
            + "Die Mieten sind in den letzten Jahren deutlich gestiegen, besonders in der Nähe des Zentrums. "
            + "Deshalb ziehen manche Familien in kleinere Orte und fahren jeden Tag mit der Bahn zur Arbeit.";
    private static final String SPORT = "Der Sportverein im Stadtteil bietet seit diesem Herbst neue Kurse für Erwachsene an. "
            + "Wer am Abend keine Zeit hat, kann auch am Samstagvormittag kommen und zuerst kostenlos mitmachen. "
            + "Die Anmeldung ist im Büro des Vereins oder über die Internetseite möglich.";

    private static TeilDoc doc(String cell, String theme, String text, List<String> cores, String key) {
        return new TeilDoc(cell, cell.replace('#', ' '), theme, text, cores, key,
                Map.of("EASY", 2, "MEDIUM", 2, "HARD", 1, "EXPERT", 0), Map.of("EASY", 2, "MEDIUM", 2, "HARD", 1));
    }

    private static Check find(List<Check> cs, String key) {
        return cs.stream().filter(c -> c.key().equals(key)).findFirst().orElseThrow();
    }

    @Test
    @DisplayName("bộ sạch, chưa có gì để so: mọi mục xanh, không chặn duyệt")
    void clean() {
        List<Check> cs = ExamSetChecks.run(List.of(doc("LESEN#2", "Wohnen", WOHNEN, List.of("die mieten sind gestiegen"), "abcab"),
                doc("LESEN#3", "Sport", SPORT, List.of("der verein bietet kurse an"), "cabxa")), List.of());
        assertThat(cs).extracting(Check::key).containsExactly("SET_THEMES", "SET_INTERNAL", "SET_UNIQUE_TEXT",
                "SET_UNIQUE_ITEMS", "SET_ANSWER_KEYS", "SET_LETTERS", "SET_DIFFICULTY");
        assertThat(cs).allSatisfy(c -> assertThat(c.light()).isEqualTo("GREEN"));
        assertThat(ExamSetChecks.hasRed(cs)).isFalse();
        assertThat(find(cs, "SET_UNIQUE_TEXT").detail()).isEqualTo("Chưa có Teil nào khác để so.");
    }

    @Test
    @DisplayName("hai Teil trùng chủ đề ⇒ đỏ; hai Teil chép chữ của nhau ⇒ đỏ")
    void themeAndInternal() {
        List<Check> cs = ExamSetChecks.run(List.of(doc("LESEN#2", "Wohnen", WOHNEN, List.of("a b"), "abcab"),
                doc("SPRACHBAUSTEINE#1", "wohnen", WOHNEN + " Das ist neu.", List.of("c d"), "bcabc")), List.of());
        assertThat(find(cs, "SET_THEMES").light()).isEqualTo("RED");
        assertThat(find(cs, "SET_THEMES").detail()).contains("LESEN 2").contains("SPRACHBAUSTEINE 1");
        assertThat(find(cs, "SET_INTERNAL").light()).isEqualTo("RED");
        assertThat(ExamSetChecks.hasRed(cs)).isTrue();
    }

    @Test
    @DisplayName("bài trùng một Teil đã có ở Ô KHÁC cũng bị bắt; bài khác hẳn thì nêu mức giống nhất")
    void uniqueText() {
        Other bank = new Other("Teil kho #12", "LESEN#1", WOHNEN, List.of(), "");
        List<Check> dup = ExamSetChecks.run(List.of(doc("LESEN#2", "Wohnen", WOHNEN, List.of("x y"), "abcab")), List.of(bank));
        assertThat(find(dup, "SET_UNIQUE_TEXT").light()).isEqualTo("RED");
        assertThat(find(dup, "SET_UNIQUE_TEXT").detail()).contains("100 %").contains("Teil kho #12");

        List<Check> ok = ExamSetChecks.run(List.of(doc("LESEN#2", "Sport", SPORT, List.of("x y"), "abcab")), List.of(bank));
        assertThat(find(ok, "SET_UNIQUE_TEXT").light()).isEqualTo("GREEN");
        assertThat(find(ok, "SET_UNIQUE_TEXT").detail()).startsWith("Giống nhất:");
    }

    @Test
    @DisplayName("câu trùng hẳn câu của bộ khác ⇒ đỏ; câu lặp trong chính bộ ⇒ đỏ; câu rỗng không tính")
    void uniqueItems() {
        Other other = new Other("lượt #4 (LESEN 2)", "LESEN#2", SPORT, List.of("die mieten sind gestiegen", ""), "cabca");
        List<Check> cs = ExamSetChecks.run(List.of(
                doc("LESEN#2", "Wohnen", WOHNEN, List.of("die mieten sind gestiegen", ""), "abcab"),
                doc("LESEN#3", "Reisen", "Ein anderer Text ohne Wiederholung von Wörtern aus dem ersten Text hier.",
                        List.of("neu eins", "neu eins", ""), "bxaxc")), List.of(other));
        Check c = find(cs, "SET_UNIQUE_ITEMS");
        assertThat(c.light()).isEqualTo("RED");
        assertThat(c.detail()).contains("LESEN 2 có câu trùng lượt #4").contains("LESEN 3 có câu lặp lại trong chính bộ này");
    }

    @Test
    @DisplayName("chuỗi đáp án trùng Teil cùng ô của bộ khác ⇒ vàng; khác ô thì không tính")
    void answerKeys() {
        List<Other> corpus = List.of(new Other("Teil kho #3", "LESEN#2", SPORT, List.of(), "ABCAB"),
                new Other("Teil kho #4", "LESEN#3", SPORT, List.of(), "bbbbb"));
        List<Check> cs = ExamSetChecks.run(List.of(doc("LESEN#2", "Wohnen", WOHNEN, List.of("q"), "abcab"),
                doc("SPRACHBAUSTEINE#1", "Reisen", "Ganz anderer Inhalt für diesen Teil der Prüfung mit eigenen Wörtern.",
                        List.of("r"), "bbbbb")), corpus);
        Check c = find(cs, "SET_ANSWER_KEYS");
        assertThat(c.light()).isEqualTo("YELLOW");
        assertThat(c.detail()).contains("LESEN 2").contains("Teil kho #3").doesNotContain("SPRACHBAUSTEINE");
        assertThat(ExamSetChecks.hasRed(cs)).isFalse();
    }

    @Test
    @DisplayName("một chữ chiếm quá 45 % số câu a/b/c của cả bộ ⇒ vàng; Teil ghép (chữ khác a/b/c) không tính")
    void letters() {
        List<Check> skewed = ExamSetChecks.run(List.of(doc("SPRACHBAUSTEINE#1", "A", WOHNEN, List.of("1"), "aaaaaaabcb"),
                doc("LESEN#2", "B", SPORT, List.of("2"), "aabca"), doc("LESEN#3", "C", "x", List.of("3"), "dxhfk")), List.of());
        assertThat(find(skewed, "SET_LETTERS").light()).isEqualTo("YELLOW");
        assertThat(find(skewed, "SET_LETTERS").detail()).contains("10/15");

        List<Check> even = ExamSetChecks.run(List.of(doc("SPRACHBAUSTEINE#1", "A", WOHNEN, List.of("1"), "abcabcabca"),
                doc("LESEN#2", "B", SPORT, List.of("2"), "bcabc")), List.of());
        assertThat(find(even, "SET_LETTERS").light()).isEqualTo("GREEN");
    }

    @Test
    @DisplayName("độ khó đo được lệch hồ sơ quá một phần tư số câu ⇒ vàng, nêu giao và đo được")
    void difficulty() {
        TeilDoc off = new TeilDoc("LESEN#3", "LESEN 3", "Sport", SPORT, List.of("k"), "abxcd",
                Map.of("EASY", 4, "MEDIUM", 4, "HARD", 2, "EXPERT", 0), Map.of("MEDIUM", 4, "HARD", 4, "EXPERT", 2));
        Check c = find(ExamSetChecks.run(List.of(off), List.of()), "SET_DIFFICULTY");
        assertThat(c.light()).isEqualTo("YELLOW");
        assertThat(c.detail()).isEqualTo("Giao 4-4-2-0 · đo được 0-4-4-2 (Dễ-Vừa-Khó-Siêu khó).");
    }
}
