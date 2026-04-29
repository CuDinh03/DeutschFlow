package com.deutschflow.vocabulary;

import com.deutschflow.vocabulary.dto.GlosbeLexicalEntry;
import com.deutschflow.vocabulary.service.GlosbeHtmlParser;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class GlosbeHtmlParserTest {

    private final GlosbeHtmlParser parser = new GlosbeHtmlParser();

    @Test
    void parseWordLinks_shouldExtractDetailLinksOnly() {
        Document doc = Jsoup.parse("""
                <html>
                  <body>
                    <a href="https://vi.glosbe.com/de/vi/Haus">Haus</a>
                    <a href="/de/vi/lernen">lernen</a>
                    <a href="/de/vi?page=2">next</a>
                    <a href="https://example.com/other">other</a>
                  </body>
                </html>
                """, "https://vi.glosbe.com/de/vi");

        Set<String> links = parser.parseWordLinks(doc, "https://vi.glosbe.com");

        assertThat(links)
                .contains("https://vi.glosbe.com/de/vi/Haus", "https://vi.glosbe.com/de/vi/lernen")
                .doesNotContain("https://vi.glosbe.com/de/vi?page=2");
    }

    @Test
    void parseDetail_shouldKeepUtf8MeaningAndExampleHoverData() {
        Document detail = Jsoup.parse("""
                <html>
                  <body>
                    <h1>lernen</h1>
                    <p>/ˈlɛʁnən/</p>
                    <div>ich lerne</div>
                    <div>du lernst</div>
                    <div>Wir lernen jeden Tag.</div>
                    <div>Chúng tôi học mỗi ngày.</div>
                    <div>verb</div>
                  </body>
                </html>
                """, "https://vi.glosbe.com/de/vi/lernen");

        GlosbeLexicalEntry entry = parser.parseDetail(detail, "https://vi.glosbe.com/de/vi/lernen");

        assertThat(entry).isNotNull();
        assertThat(entry.baseForm()).isEqualTo("lernen");
        assertThat(entry.phonetic()).isEqualTo("/ˈlɛʁnən/");
        assertThat(entry.exampleDe()).isEqualTo("Wir lernen jeden Tag.");
        assertThat(entry.exampleVi()).isEqualTo("Chúng tôi học mỗi ngày.");
        assertThat(entry.verbConjugations()).isNotEmpty();
    }
}
