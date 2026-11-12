package com.deutschflow.examstudio;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.examstudio.ExamStudioDtos.Scores;
import org.jsoup.Jsoup;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.net.InetAddress;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("Xưởng đề — luật thuần")
class ExamStudioRulesTest {

    @Nested
    @DisplayName("Thang 4 yếu tố → bậc")
    class Levels {
        @Test
        void bands() {
            assertThat(ItemRules.levelOf(new Scores(0, 1, 0, 0), false, false)).isEqualTo("EASY");
            assertThat(ItemRules.levelOf(new Scores(1, 1, 0, 0), false, false)).isEqualTo("MEDIUM");
            assertThat(ItemRules.levelOf(new Scores(1, 1, 2, 0), false, false)).isEqualTo("MEDIUM");
            assertThat(ItemRules.levelOf(new Scores(2, 1, 2, 0), false, false)).isEqualTo("HARD");
            assertThat(ItemRules.levelOf(new Scores(2, 2, 2, 0), false, false)).isEqualTo("HARD");
        }

        @Test
        @DisplayName("Siêu khó cần điểm 7–8 VÀ gộp ≥ 2 đoạn VÀ nhiễu đúng một nửa")
        void expertNeedsBothConditions() {
            Scores top = new Scores(2, 2, 2, 1);
            assertThat(ItemRules.levelOf(top, true, true)).isEqualTo("EXPERT");
            assertThat(ItemRules.levelOf(top, true, false)).isEqualTo("HARD");
            assertThat(ItemRules.levelOf(top, false, true)).isEqualTo("HARD");
        }

        @Test
        void scoresAreClamped() {
            assertThat(ItemRules.levelOf(new Scores(9, -3, 0, 0), false, false)).isEqualTo("MEDIUM");
        }

        @Test
        void hintOnlyWhenMismatch() {
            Scores s = new Scores(1, 1, 1, 0);
            assertThat(ItemRules.hint("MEDIUM", "MEDIUM", s, false, false)).isNull();
            assertThat(ItemRules.hint("EXPERT", "MEDIUM", s, false, false))
                    .contains("Đang là Vừa").contains("Muốn khó hơn").contains("2 đoạn");
            assertThat(ItemRules.hint("EASY", "HARD", s, false, false)).contains("Muốn dễ hơn");
        }

        @Test
        void slotsFollowPlanAndPad() {
            assertThat(ItemRules.slots(Map.of("EASY", 2, "MEDIUM", 2, "HARD", 1, "EXPERT", 0), 5))
                    .containsExactly("EASY", "EASY", "MEDIUM", "MEDIUM", "HARD");
            assertThat(ItemRules.slots(Map.of("EXPERT", 1), 3)).containsExactly("EXPERT", "MEDIUM", "MEDIUM");
        }
    }

    @Nested
    @DisplayName("Gán chữ đáp án")
    class Letters {
        @Test
        @DisplayName("5 câu: không chữ nào quá 2 lần, không 3 câu liền cùng chữ — mọi seed")
        void balancedForAnySeed() {
            for (int seed = 0; seed < 300; seed++) {
                Random rnd = new Random(seed);
                List<String> letters = new ArrayList<>(Arrays.asList(new String[5]));
                for (int i = 0; i < 5; i++) letters.set(i, ItemRules.chooseLetter(letters, i, rnd));
                assertThat(ExamDraftService.lettersBalanced(letters)).as("seed %d → %s", seed, letters).isTrue();
                assertThat(new HashSet<>(letters)).hasSize(3);
            }
        }

        @Test
        @DisplayName("sinh lại một câu giữa chừng vẫn tránh 3 câu liền cùng chữ")
        void regenerateOneAvoidsTriple() {
            List<String> letters = new ArrayList<>(Arrays.asList("a", "a", null, "b", "c"));
            for (int seed = 0; seed < 50; seed++) {
                assertThat(ItemRules.chooseLetter(letters, 2, new Random(seed))).isNotEqualTo("a");
            }
        }

        @Test
        @DisplayName("đặt đáp án đúng vào chữ đã chọn, thay {1}{2}{3} trong lời giải bằng chữ thật")
        void letterRendersExplanation() {
            List<ItemRules.RawOption> raw = List.of(
                    new ItemRules.RawOption("richtig", true, null),
                    new ItemRules.RawOption("falsch eins", false, "Zukunft statt Gegenwart"),
                    new ItemRules.RawOption("falsch zwei", false, null));
            ItemRules.Lettered l = ItemRules.letter(raw, "c", "{1} đúng; {2} là bẫy; {3} không có trong bài.");
            assertThat(l.correct()).isEqualTo("c");
            assertThat(l.options()).containsEntry("c", "richtig").containsEntry("a", "falsch eins")
                    .containsEntry("b", "falsch zwei");
            assertThat(l.explanation()).isEqualTo("c đúng; a là bẫy; b không có trong bài.");
            assertThat(l.traps()).singleElement().satisfies(t -> {
                assertThat(t.option()).isEqualTo("a");
                assertThat(t.rule()).isEqualTo("Zukunft statt Gegenwart");
            });
        }

        @Test
        void balanceRejectsDumpingAndTriples() {
            assertThat(ExamDraftService.lettersBalanced(List.of("a", "b", "c", "a", "b"))).isTrue();
            assertThat(ExamDraftService.lettersBalanced(List.of("a", "a", "a", "b", "c"))).isFalse();
            assertThat(ExamDraftService.lettersBalanced(List.of("a", "b", "a", "c", "a"))).isFalse();
        }
    }

    @Nested
    @DisplayName("Kiểm chép nguyên văn bằng hash cụm 6 từ")
    class Overlap {
        static final String SOURCE = "Das Robert Koch-Institut hat zwischen Mai 2023 und Februar 2024 rund "
                + "achttausend Erwachsene am Telefon befragt und die Schlafdauer berechnet.";

        @Test
        void detectsCopiedRun() {
            var hashes = new HashSet<>(TextChecks.shingleHashes(SOURCE, 6));
            String copied = "Neu: Das RKI hat zwischen Mai 2023 und Februar 2024 rund achttausend Erwachsene "
                    + "gefragt.";
            TextChecks.Overlap ov = TextChecks.overlap(copied, hashes, 6);
            assertThat(ov.maxRun()).isGreaterThanOrEqualTo(6);
            assertThat(ov.snippets()).anySatisfy(s -> assertThat(s).contains("Mai 2023 und Februar 2024"));
        }

        @Test
        void rewrittenTextPasses() {
            var hashes = new HashSet<>(TextChecks.shingleHashes(SOURCE, 6));
            String rewritten = "Von Mai 2023 bis Februar 2024 sprach das Institut mit etwa 8.000 Menschen am Telefon.";
            assertThat(TextChecks.overlap(rewritten, hashes, 6).maxRun()).isZero();
        }

        @Test
        @DisplayName("hash không chứa văn bản: chỉ là số 64 bit")
        void hashesAreOpaque() {
            List<Long> h = TextChecks.shingleHashes(SOURCE, 6);
            assertThat(h).isNotEmpty().allSatisfy(x -> assertThat(x).isInstanceOf(Long.class));
        }

        @Test
        void wrapKeepsParagraphsAndWidth() {
            String wrapped = TextChecks.wrap("Eins zwei drei vier fünf sechs sieben.\n\nZweiter Absatz hier.", 15);
            assertThat(wrapped.split("\n\n")).hasSize(2);
            for (String line : wrapped.split("\n")) assertThat(line.length()).isLessThanOrEqualTo(15);
            assertThat(TextChecks.wordCount(wrapped)).isEqualTo(10);
        }
    }

    @Nested
    @DisplayName("Tải trang báo")
    class Fetching {
        private SourceFetcher fetcherResolvingTo(String ip) {
            return new SourceFetcher(host -> new InetAddress[]{InetAddress.getByName(ip)});
        }

        @Test
        @DisplayName("chặn host phân giải ra địa chỉ nội bộ (SSRF)")
        void blocksInternalAddresses() {
            for (String ip : List.of("127.0.0.1", "10.0.0.5", "192.168.1.13", "172.16.3.4", "169.254.169.254",
                    "100.64.1.1", "0.0.0.0", "::1", "fd00::1", "::ffff:192.168.1.13")) {
                assertThatThrownBy(() -> fetcherResolvingTo(ip).validate("https://example.de/a"))
                        .as(ip).isInstanceOf(BadRequestException.class).hasMessageContaining("nội bộ");
            }
        }

        @Test
        void allowsPublicAddress() {
            assertThat(fetcherResolvingTo("93.184.216.34").validate("https://example.de/artikel").getHost())
                    .isEqualTo("example.de");
        }

        @Test
        void rejectsOtherSchemesPortsAndCredentials() {
            SourceFetcher f = fetcherResolvingTo("93.184.216.34");
            assertThatThrownBy(() -> f.validate("file:///etc/passwd")).isInstanceOf(BadRequestException.class);
            assertThatThrownBy(() -> f.validate("https://example.de:8080/x")).isInstanceOf(BadRequestException.class);
            assertThatThrownBy(() -> f.validate("https://u:p@example.de/x")).isInstanceOf(BadRequestException.class);
        }

        @Test
        void robotsRules() {
            String robots = """
                    User-agent: Googlebot
                    Disallow: /

                    User-agent: *
                    Disallow: /plus/
                    Allow: /plus/frei/
                    """;
            assertThat(SourceFetcher.robotsAllows(robots, "/wissen/artikel")).isTrue();
            assertThat(SourceFetcher.robotsAllows(robots, "/plus/artikel")).isFalse();
            assertThat(SourceFetcher.robotsAllows(robots, "/plus/frei/artikel")).isTrue();
            assertThat(SourceFetcher.robotsAllows("User-agent: *\nDisallow: /", "/x")).isFalse();
        }

        @Test
        @DisplayName("chỉ CC BY trơn mới được chuyển thể")
        void licenceDetection() {
            assertThat(SourceFetcher.isPlainCcBy("CC BY 4.0")).isTrue();
            assertThat(SourceFetcher.isPlainCcBy("CC-BY")).isTrue();
            assertThat(SourceFetcher.isPlainCcBy("CC BY SA 4.0")).isFalse();
            assertThat(SourceFetcher.isPlainCcBy("CC BY NC ND 3.0")).isFalse();
            assertThat(SourceFetcher.isPlainCcBy(null)).isFalse();

            var doc = Jsoup.parse("<html><body><a rel='license' href='https://creativecommons.org/licenses/by-sa/4.0/'>x</a></body></html>");
            assertThat(SourceFetcher.detectLicense(doc)).isEqualTo("CC BY-SA 4.0");
            assertThat(SourceFetcher.isPlainCcBy(SourceFetcher.detectLicense(doc))).isFalse();
        }

        @Test
        @DisplayName("bóc bài: lấy đoạn trong <article>, đọc meta; bài quá ngắn ⇒ bảo dán tay")
        void extract() {
            String para = "<p>" + "Viele Erwachsene schlafen an Arbeitstagen weniger als sieben Stunden pro Nacht. ".repeat(3) + "</p>";
            String html = "<html><head><meta property='og:title' content='Zu wenig Schlaf'>"
                    + "<meta property='og:site_name' content='Beispielzeitung'></head><body><nav><p>"
                    + "Menü Menü Menü Menü Menü Menü Menü Menü Menü Menü</p></nav><article>" + para.repeat(5)
                    + "<a href='https://creativecommons.org/licenses/by/4.0/'>Lizenz</a></article></body></html>";
            SourceFetcher.Fetched f = SourceFetcher.extract(Jsoup.parse(html), "https://example.de/a");
            assertThat(f.title()).isEqualTo("Zu wenig Schlaf");
            assertThat(f.publisher()).isEqualTo("Beispielzeitung");
            assertThat(f.ccBy()).isTrue();
            assertThat(f.text()).doesNotContain("Menü");

            assertThatThrownBy(() -> SourceFetcher.extract(Jsoup.parse("<html><body><article><p>kurz</p></article></body></html>"), "u"))
                    .isInstanceOf(BadRequestException.class).hasMessageContaining("dán văn bản");
        }

        @Test
        @DisplayName("bóc bài: trang hướng dẫn để nội dung trong danh sách — lấy <li> dài, bỏ mục điều hướng, không lấy hai lần")
        void extractLists() {
            String li = "<li>Für die Anmeldung des Wohnsitzes brauchen Sie einen Lichtbildausweis und den Meldezettel. </li>";
            String html = "<html><body><main><nav><ul><li>Startseite und weitere Seiten in der Navigation des Portals</li></ul></nav>"
                    + "<p>Wer umzieht, muss den neuen Wohnsitz innerhalb von drei Tagen bei der Behörde anmelden.</p>"
                    + "<ul>" + li.repeat(9) + "<li><p>Dieser Punkt steht in einem Absatz innerhalb der Liste und zählt nur einmal mit.</p></li>"
                    + "<li>kurz</li></ul></main></body></html>";
            SourceFetcher.Fetched f = SourceFetcher.extract(Jsoup.parse(html), "https://example.at/umzug");
            assertThat(f.text()).contains("Lichtbildausweis").contains("innerhalb von drei Tagen")
                    .doesNotContain("Startseite").doesNotContain("kurz");
            assertThat(f.text().split("Dieser Punkt steht", -1)).hasSize(2);
        }
    }

    @Nested
    @DisplayName("Dòng Quelle")
    class Quelle {
        private ExamDraftService.SourceRow src(String usage, String author, String title, String publisher,
                                               String date, String url, String licence) {
            var fact = new ExamStudioDtos.Fact("s1f1", "x", null, null, 1, false, true);
            return new ExamDraftService.SourceRow(new ExamStudioDtos.Source(1, url, publisher, title, author, date,
                    licence, usage, true, "OK", null, List.of(fact)), new HashSet<>());
        }

        @Test
        void adaptCitesAuthorLicenceAndChange() {
            String q = ExamDraftService.quelle(List.of(src("ADAPT", "Kaufholdová N", "Schlaf", "RKI", "2026-08-19",
                    "https://doi.org/10.25646/14300", "CC BY 4.0")));
            assertThat(q).startsWith("Quelle: nach Kaufholdová N: „Schlaf“, RKI 2026, https://doi.org/10.25646/14300 · CC BY 4.0")
                    .endsWith("neu geschrieben und vereinfacht.");
        }

        @Test
        void factsOnlyNamesDataNotText() {
            String q = ExamDraftService.quelle(List.of(src("FACTS_ONLY", null, "Titel", "tagesschau.de",
                    "2026-11-01T08:00:00Z", "https://x", null)));
            assertThat(q).isEqualTo("Daten: tagesschau.de, 2026-11-01 · Text für die Prüfung neu geschrieben.");
        }

        @Test
        void noSelectedFactsNoQuelle() {
            var s = new ExamDraftService.SourceRow(new ExamStudioDtos.Source(1, null, "P", "T", null, null, null,
                    "ADAPT", true, "OK", null, List.of()), new HashSet<>());
            assertThat(ExamDraftService.quelle(List.of(s))).isNull();
        }
    }

    @Nested
    @DisplayName("Lesen Teil 1 — ghép tiêu đề")
    class Headlines {
        private ExamStudioDtos.Item item(String id, String correct, Map<String, String> options) {
            return new ExamStudioDtos.Item(id, "Text 1", options, correct, "x", "ev", List.of(), "EASY", null, false, null, List.of());
        }

        @Test
        void formatNeedsCorrectPlusOneNearHeadline() {
            TeilSpec t1 = TeilSpec.find("TELC", "B1", "LESEN", 1).orElseThrow();
            assertThat(t1.headlines()).isTrue();
            assertThat(ExamDraftService.formatOk(item("LV1-1", "g", Map.of("g", "Richtig", "c", "Falle")), t1)).isTrue();
            assertThat(ExamDraftService.formatOk(item("LV1-1", "k", Map.of("k", "Richtig", "c", "Falle")), t1)).isFalse();
            assertThat(ExamDraftService.formatOk(item("LV1-1", "g", Map.of("g", "Richtig")), t1)).isFalse();
        }

        @Test
        void tenDistinctLettersAndHeadlines() {
            var ok = List.of(item("LV1-1", "a", Map.of("a", "A", "b", "B")), item("LV1-2", "c", Map.of("c", "C", "d", "D")));
            assertThat(ExamDraftService.headlinesOk(ok)).isTrue();
            var dupLetter = List.of(item("LV1-1", "a", Map.of("a", "A", "b", "B")), item("LV1-2", "a", Map.of("a", "C", "d", "D")));
            assertThat(ExamDraftService.headlinesOk(dupLetter)).isFalse();
            var dupText = List.of(item("LV1-1", "a", Map.of("a", "Gleich", "b", "B")), item("LV1-2", "c", Map.of("c", "gleich", "d", "D")));
            assertThat(ExamDraftService.headlinesOk(dupText)).isFalse();
        }
    }
}
