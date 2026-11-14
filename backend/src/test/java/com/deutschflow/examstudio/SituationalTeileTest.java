package com.deutschflow.examstudio;

import com.deutschflow.examstudio.ExamStudioDtos.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DisplayName("Xưởng đề đợt 3 — Teil theo tình huống và chống trùng")
class SituationalTeileTest {

    static final String LETTER = """
            Sehr geehrte Damen und Herren,

            ich wende mich heute mit einem dringenden Problem an Sie. Die Heizung funktioniert nicht, obwohl ich sie ganz aufdrehe.
            Deshalb bitte ich Sie, einen Techniker zu schicken. Ich wäre Ihnen sehr dankbar.

            Mit freundlichen Grüßen
            Daniel Krause""";

    private final SituationalTeile situ = new SituationalTeile(null);

    private static Item gapItem(String id, String target, String before, String gap, String correct, Map<String, String> opts) {
        return new Item(id, "q", opts, correct, "x", "ev", List.of(), "EASY", null, false, null, List.of(),
                Map.of("target", target, "before", before, "gap", gap));
    }

    @Nested
    @DisplayName("Định vị ô trong thư")
    class Gaps {
        @Test
        void locateUsesBeforePhraseAndRejectsAmbiguity() {
            int pos = SituationalTeile.locate(LETTER, "nicht,", "obwohl");
            assertThat(LETTER.substring(pos, pos + 6)).isEqualTo("obwohl");
            // "Sie" xuất hiện nhiều lần: không có cụm trước thì mơ hồ ⇒ -1
            assertThat(SituationalTeile.locate(LETTER, "", "Sie")).isEqualTo(-1);
            assertThat(SituationalTeile.locate(LETTER, "bitte ich", "Sie")).isPositive();
            assertThat(SituationalTeile.locate(LETTER, "gibt es nicht", "obwohl")).isEqualTo(SituationalTeile.locate(LETTER, "", "obwohl"));
            assertThat(SituationalTeile.locate(LETTER, "x", "Fernseher")).isEqualTo(-1);
        }

        @Test
        @DisplayName("thư có ô: từ gốc thay bằng ___N___ đúng chỗ, phần còn lại giữ nguyên")
        void gappedText() {
            List<Item> items = List.of(
                    gapItem("SB1-21", "mit", "wende mich heute", "21", "a", Map.of()),
                    gapItem("SB1-22", "obwohl", "funktioniert nicht,", "22", "b", Map.of()),
                    gapItem("SB1-23", "wäre", "Ich", "23", "c", Map.of()));
            String g = SituationalTeile.gappedText(LETTER, items);
            assertThat(g).contains("wende mich heute ___21___ einem").contains("nicht, ___22___ ich")
                    .contains("Ich ___23___ Ihnen").doesNotContain("obwohl").startsWith("Sehr geehrte");
        }

        @Test
        void formatOkNeedsCorrectOptionEqualToTarget() {
            TeilSpec sb1 = TeilSpec.find("TELC", "B1", "SPRACHBAUSTEINE", 1).orElseThrow();
            Text t = new Text("", "", LETTER, List.of());
            Item ok = gapItem("SB1-21", "obwohl", "nicht,", "21", "b", Map.of("a", "weil", "b", "obwohl", "c", "damit"));
            Item bad = gapItem("SB1-21", "obwohl", "nicht,", "21", "a", Map.of("a", "weil", "b", "obwohl", "c", "damit"));
            assertThat(situ.formatOk(sb1, t, ok)).isTrue();
            assertThat(situ.formatOk(sb1, t, bad)).isFalse();
        }

        @Test
        void confusablePairs() {
            assertThat(SituationalTeile.hasConfusablePair(List.of("MICH", "MIR", "FÜR"))).isTrue();
            assertThat(SituationalTeile.hasConfusablePair(List.of("AM", "BIS", "FÜR"))).isFalse();
        }
    }

    @Nested
    @DisplayName("Khuôn đầu ra đúng đề telc (V343)")
    class Content {
        @Test
        void lesenTeil3() {
            TeilSpec lv3 = TeilSpec.find("TELC", "B1", "LESEN", 3).orElseThrow();
            Map<String, String> ads = new LinkedHashMap<>();
            for (String l : TeilSpec.AD_LETTERS) ads.put(l, "Anzeige " + l);
            Text t = new Text("", "", "", List.of(), ads,
                    List.of(new Example("01", "Sie feiern.", "l"), new Example("02", "Sie suchen Fahrlehrer.", "x")),
                    null, null, null, null);
            List<Item> items = new ArrayList<>();
            for (int i = 0; i < 10; i++) {
                String c = i < 8 ? TeilSpec.AD_LETTERS.get(i) : "x";
                items.add(new Item(lv3.itemId(i), "Situation " + i, Map.of("k", "Anzeige k"), c, "vi", "ev", List.of(),
                        "MEDIUM", null, false, null, List.of()));
            }
            Map<String, Object> c = situ.content(lv3, t, items);
            assertThat(c).containsEntry("type", "MATCH_AD_X").containsEntry("allow_none", true)
                    .containsEntry("single_use", true).containsEntry("point_per_item", 2.5);
            assertThat((Map<?, ?>) c.get("ads")).hasSize(12);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> out = (List<Map<String, Object>>) c.get("items");
            assertThat(out).hasSize(10);
            assertThat(out.get(0)).containsEntry("id", "LV3-11").containsEntry("question", "Situation 0");

            List<Check> checks = situ.checks(lv3, t, items, null);
            assertThat(checks).filteredOn(ch -> ch.key().equals("X_COUNT")).singleElement()
                    .satisfies(ch -> assertThat(ch.light()).isEqualTo("GREEN"));
            assertThat(checks).filteredOn(ch -> ch.key().equals("ADS_UNIQUE")).singleElement()
                    .satisfies(ch -> assertThat(ch.light()).isEqualTo("GREEN"));
        }

        @Test
        @DisplayName("Lesen T3: mẩu rao vặt giữ quy ước dòng của áp phích; mẩu một dòng ra như cũ")
        void adLinesKeepPosterLines() {
            assertThat(SituationalTeile.adLines("Gitarre lernen\n  für Anfänger   jeden Alters \n\n- Erste Stunde kostenlos\r\nTel. 0341-12 34 56\n"))
                    .isEqualTo("Gitarre lernen\nfür Anfänger jeden Alters\nErste Stunde kostenlos\nTel. 0341-12 34 56");
            // model thoát hai lần: "\n" thành hai ký tự
            assertThat(SituationalTeile.adLines("Nähkurs\\nfür Erwachsene\\nTel. 0341-12 34 56"))
                    .isEqualTo("Nähkurs\nfür Erwachsene\nTel. 0341-12 34 56");
            // kiểu cũ (một đoạn): chỉ gộp khoảng trắng, y như trước
            assertThat(SituationalTeile.adLines("  Verkaufe   Kinderfahrrad, 20 Zoll.  60 € VB. "))
                    .isEqualTo("Verkaufe Kinderfahrrad, 20 Zoll. 60 € VB.");
        }

        @Test
        @DisplayName("Lesen T3: đếm từ và kiểm độ dài tính đúng trên mẩu nhiều dòng; prompt format được")
        void multiLineAdsCountWordsAcrossLines() {
            TeilSpec lv3 = TeilSpec.find("TELC", "B1", "LESEN", 3).orElseThrow();
            String oneLine = "Gitarre lernen für Anfänger jeden Alters Unterricht bei Ihnen zu Hause oder in meinem Studio"
                    + " Erste Stunde kostenlos danach zehn Euro pro Stunde Tel. 0341-12 34 56";
            String poster = "Gitarre lernen\nfür Anfänger jeden Alters\nUnterricht bei Ihnen zu Hause oder in meinem Studio\n"
                    + "Erste Stunde kostenlos danach zehn Euro pro Stunde\nTel. 0341-12 34 56";
            assertThat(TextChecks.wordCount(poster)).isEqualTo(TextChecks.wordCount(oneLine));

            Map<String, String> ads = new LinkedHashMap<>();
            for (String l : TeilSpec.AD_LETTERS) {
                ads.put(l, SituationalTeile.adLines(String.join("\n", Collections.nCopies(Math.max(1, lv3.minWords()), "Wort" + l))));
            }
            Text t = new Text("", "", "", List.of(), ads, List.of(), null, null, null, null);
            assertThat(situ.checks(lv3, t, List.of(), null)).filteredOn(ch -> ch.key().equals("LENGTH")).singleElement()
                    .satisfies(ch -> assertThat(ch.light()).isEqualTo("GREEN"));
            // chữ người học đọc được (dùng cho chống trùng) coi xuống dòng như khoảng trắng: cùng dãy từ
            assertThat(TextChecks.words(situ.content(lv3, t, List.of()).get("ads").toString().replaceAll("[{}=,]", " ")))
                    .contains("Worta", "Wortl");

            String prompt = SituationalTeile.ADS_SYSTEM.formatted("B1", 12, lv3.minWords(), lv3.maxWords(), "EINE Beispiel-Situation.");
            assertThat(prompt).contains("GENAU 12").contains("Zeile 1 = kurze Überschrift").contains("Kontaktzeile")
                    .contains("im JSON als \\n").contains("Schreibe außerdem EINE Beispiel-Situation.")
                    .doesNotContain("%");
        }

        @Test
        @DisplayName("Lesen T3: thiếu câu x hoặc một mẩu làm đáp án hai lần ⇒ đỏ")
        void lesenTeil3Red() {
            TeilSpec lv3 = TeilSpec.find("TELC", "B1", "LESEN", 3).orElseThrow();
            Text t = new Text("", "", "", List.of(), Map.of("a", "A"), List.of(), null, null, null, null);
            List<Item> items = List.of(
                    new Item("LV3-11", "S", Map.of(), "a", "", "", List.of(), "EASY", null, false, null, List.of()),
                    new Item("LV3-12", "S", Map.of(), "a", "", "", List.of(), "EASY", null, false, null, List.of()));
            List<Check> checks = situ.checks(lv3, t, items, null);
            assertThat(checks).filteredOn(ch -> Set.of("X_COUNT", "ADS_UNIQUE").contains(ch.key()))
                    .allSatisfy(ch -> assertThat(ch.light()).isEqualTo("RED"));
        }

        @Test
        void sprachbausteine2BankAndGaps() {
            TeilSpec sb2 = TeilSpec.find("TELC", "B1", "SPRACHBAUSTEINE", 2).orElseThrow();
            Map<String, String> bank = new LinkedHashMap<>();
            List<String> words = List.of("AM", "BIS", "DASS", "FÜR", "IM", "MICH", "MIR", "MIT", "OB", "OBWOHL",
                    "OHNE", "SEIT", "WANN", "WENN", "WIE");
            for (int i = 0; i < 15; i++) bank.put(TeilSpec.BANK_LETTERS.get(i), words.get(i));
            Text t = new Text("", "", LETTER, List.of(), null, null, "Kochkurs …", bank, null, null);
            Item it = new Item("SB2-31", "q", Map.of("j", "OBWOHL"), "j", "x", "ev", List.of(), "HARD", null, false, null,
                    List.of(), Map.of("target", "obwohl", "before", "nicht,", "gap", "31"));
            assertThat(situ.formatOk(sb2, t, it)).isTrue();
            Map<String, Object> c = situ.content(sb2, t, List.of(it));
            assertThat(c).containsEntry("type", "GAP_WORDBANK").containsKey("stimulus_ad").containsKey("word_bank");
            assertThat((String) c.get("gapped_text")).contains("___31___");
            assertThat(situ.checks(sb2, t, List.of(it), null)).filteredOn(ch -> ch.key().equals("PAIRS")).singleElement()
                    .satisfies(ch -> assertThat(ch.light()).isEqualTo("GREEN"));
        }

        @Test
        @DisplayName("Schreiben: không có type/điểm từng câu, có stimulus + 4 Leitpunkte xáo")
        void schreiben() {
            TeilSpec sa = TeilSpec.find("TELC", "B1", "SCHREIBEN", 1).orElseThrow();
            assertThat(sa.writing()).isTrue();
            Text t = new Text("", "", "Hallo! Wie geht es dir?", List.of(), null, null, null, null,
                    new Stimulus("EMAIL", "Jonas", "Party", "Hallo! Kommst du zu meiner Party? Was machst du gerade?"),
                    List.of("A", "B", "C", "D"));
            Map<String, Object> c = situ.content(sa, t, List.of());
            assertThat(c).doesNotContainKey("type").doesNotContainKey("items").containsEntry("shuffle_points", true);
            assertThat((List<?>) c.get("writing_points")).hasSize(4);
            assertThat(situ.checks(sa, t, List.of(), null)).filteredOn(ch -> ch.key().equals("DU")).singleElement()
                    .satisfies(ch -> assertThat(ch.light()).isEqualTo("GREEN"));
        }
    }

    @Nested
    @DisplayName("Chống trùng")
    class Dedup {
        private ExamDedupService dedupWithBank(Map<String, Object> content) {
            JdbcTemplate jdbc = mock(JdbcTemplate.class);
            return new ExamDedupService(jdbc, new ObjectMapper());
        }

        @Test
        void contentTextCoversEveryTeilShape() {
            Map<String, Object> c = new LinkedHashMap<>();
            c.put("ads", Map.of("a", "Waschmaschine zu verkaufen"));
            c.put("gapped_text", "Sehr geehrte ___21___");
            c.put("stimulus", Map.of("body", "Hallo Jonas"));
            c.put("writing_points", List.of("Tipp geben"));
            c.put("items", List.of(Map.of("question", "Sie suchen eine Wohnung", "options", Map.of("a", "mit"))));
            String text = ExamDedupService.contentText(c);
            assertThat(text).contains("Waschmaschine", "___21___", "Hallo Jonas", "Tipp geben", "Sie suchen eine Wohnung", "mit");
        }

        @Test
        @DisplayName("Teil gần như chép lại một Teil kho ⇒ điểm giống > ngưỡng; Teil khác hẳn ⇒ thấp")
        void mostSimilar() {
            ExamDedupService d = dedupWithBank(null);
            String a = "Die Stadtbibliothek bietet jeden Donnerstag ein Sprachcafé für Menschen an, die neu in Deutschland sind und ohne Druck sprechen üben möchten.";
            var bank = List.of(new ExamDedupService.BankBlock(7, Map.of("context", a)));
            assertThat(d.mostSimilar(bank, a + " Tee gibt es gratis.").orElseThrow().score()).isGreaterThan(ExamDedupService.TEIL_LIMIT);
            assertThat(d.mostSimilar(bank, "Ein neuer Fahrradladen repariert Räder direkt vor der Haustür, auch am Abend und am Wochenende.")
                    .orElseThrow().score()).isLessThan(ExamDedupService.TEIL_LIMIT);
        }

        @Test
        @DisplayName("câu trùng câu kho (cả khi đổi số ô / chữ đáp án) ⇒ bị bắt; câu khác ⇒ không")
        void itemDuplicates() {
            ExamDedupService d = dedupWithBank(null);
            var bank = List.of(new ExamDedupService.BankBlock(12, Map.of("items", List.of(Map.of(
                    "id", "LV3-14", "question", "Ihr Vater möchte lernen, wie er seinen Enkeln Fotos per E-Mail schickt.",
                    "options", Map.of("e", "Computerhilfe für Senioren"), "correct", "e")))));
            Item same = new Item("LV3-11", "Ihr Vater möchte lernen, wie er seinen Enkeln Fotos per E-Mail schickt.",
                    Map.of("c", "Computerhilfe für Senioren"), "c", "", "", List.of(), "EASY", null, false, null, List.of());
            Item other = new Item("LV3-12", "Sie suchen einen Babysitter für Samstagabend.",
                    Map.of("a", "Babysitterin hat Zeit"), "a", "", "", List.of(), "EASY", null, false, null, List.of());
            var dups = d.itemDuplicates(bank, List.of(same, other));
            assertThat(dups).singleElement().satisfies(x -> {
                assertThat(x.itemId()).isEqualTo("LV3-11");
                assertThat(x.blockId()).isEqualTo(12);
                assertThat(x.exact()).isTrue();
            });
        }

        @Test
        @DisplayName("Lesen T1: \"Text 3\" không làm hai câu khác nhau bị coi là trùng")
        void genericTextLabelIgnored() {
            assertThat(ExamDedupService.itemCore("Text 3", "Neue Markthalle eröffnet"))
                    .isEqualTo("neue markthalle eröffnet");
        }

        @Test
        void avoidListSummarisesBank() {
            ExamDedupService d = dedupWithBank(null);
            var bank = List.of(new ExamDedupService.BankBlock(1, Map.of("title_de", "Zu wenig Schlaf")),
                    new ExamDedupService.BankBlock(2, Map.of("stimulus_ad", "Kochkurs Vegetarisch")));
            assertThat(d.avoidList(bank, 10)).containsExactly("Zu wenig Schlaf", "Kochkurs Vegetarisch");
        }
    }
}
