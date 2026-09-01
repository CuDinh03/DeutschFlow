package com.deutschflow.teacher.curriculumimport;

import com.deutschflow.teacher.curriculumimport.template.CurriculumTemplate;
import com.deutschflow.teacher.curriculumimport.template.TemplateUnit;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Rule-based reading of a coursebook's contents pages. Every fixture here is a SYNTHETIC book —
 * no text from a real, copyrighted coursebook enters the repository — which also keeps the tests
 * honest about the parser being generic rather than tuned to one publisher.
 */
class TocParserTest {

    private final TocParser parser = new TocParser();

    private static final String SYNTHETIC_TOC = """
            Inhalt

            1  Erste Schritte                                        6
            sich begrüßen | den Namen nennen | bis zehn zählen | Wörter buchstabieren
            Wortschatz     Zahlen 1–10 | Begrüßungen
            Grammatik      Aussagesatz | W-Frage | Personalpronomen
            Aussprache     Vokale
            Strategie      Wörter sammeln
            Landeskunde    Begrüßen im Alltag

            2  Meine Stadt                                          16
            Orte benennen | nach dem Weg fragen | Verkehrsmittel nennen | über Wege sprechen
            Wortschatz     Orte | Verkehrsmittel
            Grammatik      bestimmter Artikel | Präpositionen
            Aussprache     Konsonanten
            Strategie      Karten lesen
            Landeskunde    Stadtleben

            Plattform 1: wiederholen und trainieren, Landeskunde: Feste   26

            3  Im Kurs                                              30
            über den Kurs sprechen | Materialien benennen | Termine nennen | um Hilfe bitten
            Wortschatz     Kursmaterial | Wochentage
            Grammatik      Modalverben | Satzklammer
            Aussprache     Satzmelodie
            Strategie      Notizen machen
            Landeskunde    Lernen in D-A-CH

            Anhang  Grammatikübersicht 40 | Wortliste 44
            """;

    @Test
    void readsChaptersInOrderWithTitlesAndStartPages() {
        CurriculumTemplate t = parser.parse(SYNTHETIC_TOC, "A1", "Testbuch A1").template();

        List<TemplateUnit> chapters = t.units().stream().filter(TemplateUnit::isChapter).toList();
        assertThat(chapters).extracting(TemplateUnit::title)
                .containsExactly("Erste Schritte", "Meine Stadt", "Im Kurs");
        assertThat(chapters).extracting(TemplateUnit::bookPageFrom).containsExactly(6, 16, 30);
    }

    @Test
    void recognisesReviewUnitsAsReviewKind() {
        CurriculumTemplate t = parser.parse(SYNTHETIC_TOC, "A1", "Testbuch A1").template();

        List<TemplateUnit> reviews = t.units().stream().filter(u -> !u.isChapter()).toList();
        assertThat(reviews).hasSize(1);
        assertThat(reviews.get(0).title()).isEqualTo("Plattform 1");
        assertThat(reviews.get(0).bookPageFrom()).isEqualTo(26);
    }

    @Test
    void unitsAppearInReadingOrderWithChaptersAndReviewsInterleaved() {
        CurriculumTemplate t = parser.parse(SYNTHETIC_TOC, "A1", "Testbuch A1").template();

        assertThat(t.units()).extracting(TemplateUnit::title)
                .containsExactly("Erste Schritte", "Meine Stadt", "Plattform 1", "Im Kurs");
    }

    @Test
    void derivesEachUnitsEndPageFromTheNextUnitsStart() {
        CurriculumTemplate t = parser.parse(SYNTHETIC_TOC, "A1", "Testbuch A1").template();

        assertThat(t.units().get(0).bookPageTo()).isEqualTo(15);
        assertThat(t.units().get(1).bookPageTo()).isEqualTo(25);
        assertThat(t.units().get(2).bookPageTo()).isEqualTo(29);
        // The last unit ends where the appendix begins.
        assertThat(t.units().get(3).bookPageTo()).isEqualTo(39);
    }

    @Test
    void collectsGoalsFromTheLineBelowTheChapterHeading() {
        TemplateUnit first = parser.parse(SYNTHETIC_TOC, "A1", "Testbuch A1").template().units().get(0);

        assertThat(first.goals()).containsExactly(
                "sich begrüßen", "den Namen nennen", "bis zehn zählen", "Wörter buchstabieren");
    }

    @Test
    void mapsGermanContentRowsOntoTheTagWhitelist() {
        TemplateUnit first = parser.parse(SYNTHETIC_TOC, "A1", "Testbuch A1").template().units().get(0);

        assertThat(first.contentFor("WORTSCHATZ")).containsExactly("Zahlen 1–10", "Begrüßungen");
        assertThat(first.contentFor("GRAMMATIK")).containsExactly("Aussagesatz", "W-Frage", "Personalpronomen");
        assertThat(first.contentFor("AUSSPRACHE")).containsExactly("Vokale");
        assertThat(first.contentFor("STRATEGIE")).containsExactly("Wörter sammeln");
        assertThat(first.contentFor("LANDESKUNDE")).containsExactly("Begrüßen im Alltag");
    }

    @Test
    void toleratesOcrNoiseAroundSeparatorsAndSpacing() {
        String noisy = """
            1   Erste  Schritte                                      6
            sich begrüßen  I  den Namen nennen  |  bis zehn zählen
            Wortschatz    Zahlen 1–10  l  Begrüßungen
            Grammatik     Aussagesatz | W-Frage
            2   Meine Stadt                                         16
            Orte benennen | nach dem Weg fragen
            Wortschatz    Orte
            Grammatik     Artikel
            """;

        CurriculumTemplate t = parser.parse(noisy, "A1", "Noisy").template();

        assertThat(t.units()).hasSize(2);
        assertThat(t.units().get(0).title()).isEqualTo("Erste Schritte");
        // "I" and "l" are what OCR makes of the pipe separator in this typeface.
        assertThat(t.units().get(0).goals())
                .containsExactly("sich begrüßen", "den Namen nennen", "bis zehn zählen");
        assertThat(t.units().get(0).contentFor("WORTSCHATZ")).containsExactly("Zahlen 1–10", "Begrüßungen");
    }

    @Test
    void readsAHeadingThatOcrPrefixedWithThePagesEdgeRule() {
        // Observed on the real scan: the vertical rule at the page edge comes back as a leading "|"
        // on one heading ("| 10 Studium und Beruf 116"), which silently cost a whole chapter.
        CurriculumTemplate t = parser.parse("""
                1  Erste Schritte                                     6
                etwas tun | etwas anderes tun
                Wortschatz   A | B
                | 2  Meine Stadt                                     16
                Orte benennen | nach dem Weg fragen
                Wortschatz   Orte | Verkehrsmittel
                """, "A1", "Edge").template();

        assertThat(t.units()).extracting(TemplateUnit::title)
                .containsExactly("Erste Schritte", "Meine Stadt");
        assertThat(t.units().get(1).bookPageFrom()).isEqualTo(16);
    }

    @Test
    void reportsLowConfidenceWhenNothingLooksLikeATableOfContents() {
        TocParser.TocParseResult r = parser.parse("Impressum\nAlle Rechte vorbehalten.\n", "A1", "X");

        assertThat(r.template().units()).isEmpty();
        assertThat(r.confident()).isFalse();
        assertThat(r.warnings()).isNotEmpty();
    }

    @Test
    void aSingleChapterIsTooThinToTrustAndIsFlagged() {
        TocParser.TocParseResult r = parser.parse("""
                1  Nur ein Kapitel                                    6
                etwas tun | etwas anderes tun
                Wortschatz   A | B
                """, "A1", "X");

        assertThat(r.template().units()).hasSize(1);
        assertThat(r.confident()).isFalse();
    }

    @Test
    void aContentsPageReadTwiceStillYieldsOneUnitPerChapter() {
        // A two-page spread photographed with an overlap, or an OCR pass that re-reads a page,
        // must not import every chapter twice.
        CurriculumTemplate t = parser.parse(SYNTHETIC_TOC + "\n" + SYNTHETIC_TOC, "A1", "Testbuch A1")
                .template();

        assertThat(t.units()).extracting(TemplateUnit::title)
                .containsExactly("Erste Schritte", "Meine Stadt", "Plattform 1", "Im Kurs");
        assertThat(t.units().get(0).contentFor("WORTSCHATZ")).containsExactly("Zahlen 1–10", "Begrüßungen");
        assertThat(t.units().get(0).goals()).containsExactly(
                "sich begrüßen", "den Namen nennen", "bis zehn zählen", "Wörter buchstabieren");
    }

    @Test
    void ignoresAppendixAndPageFurnitureLines() {
        CurriculumTemplate t = parser.parse(SYNTHETIC_TOC, "A1", "Testbuch A1").template();

        assertThat(t.units()).extracting(TemplateUnit::title)
                .doesNotContain("Anhang", "Inhalt", "Grammatikübersicht", "Wortliste");
    }
}
