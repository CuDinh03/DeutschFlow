package com.deutschflow.examstudio;

import com.deutschflow.examstudio.SourceCatalog.Entry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Xưởng đề — danh mục nguồn: đọc feed, trang mục lục, chuẩn hoá đường dẫn")
class SourceCatalogTest {

    @Test
    @DisplayName("RSS 2.0: lấy đường dẫn, tiêu đề, ngày; bỏ link của kênh; gộp bài trùng")
    void rss() {
        List<Entry> es = SourceCatalog.parseRss("""
                <?xml version="1.0" encoding="UTF-8"?>
                <rss version="2.0"><channel>
                  <title>Statistisches Bundesamt</title>
                  <link>https://www.destatis.de</link>
                  <item>
                    <title>Mieten   steigen 2025 um 2,1 %</title>
                    <link>https://www.destatis.de/DE/Presse/Pressemitteilungen/2026/11/PD26_392_611.html?utm_source=rss</link>
                    <pubDate>Wed, 11 Nov 2026 08:00:00 +0100</pubDate>
                  </item>
                  <item>
                    <title>Dieselbe Meldung noch einmal</title>
                    <link>https://www.destatis.de/DE/Presse/Pressemitteilungen/2026/11/PD26_392_611.html</link>
                  </item>
                  <item><title>Ohne Link</title></item>
                  <item>
                    <title>Zahl der Woche</title>
                    <link>https://www.destatis.de/DE/Presse/Pressemitteilungen/Zahl-der-Woche/2026/PD26_46_p002.html</link>
                  </item>
                </channel></rss>
                """);
        assertThat(es).extracting(Entry::url).containsExactly(
                "https://www.destatis.de/DE/Presse/Pressemitteilungen/2026/11/PD26_392_611.html",
                "https://www.destatis.de/DE/Presse/Pressemitteilungen/Zahl-der-Woche/2026/PD26_46_p002.html");
        assertThat(es.get(0).title()).isEqualTo("Mieten steigen 2025 um 2,1 %");
        assertThat(es.get(0).publishedAt()).isEqualTo(Instant.parse("2026-11-11T07:00:00Z"));
        assertThat(es.get(1).publishedAt()).isNull();
    }

    @Test
    @DisplayName("Atom: link nằm ở thuộc tính href, ngày ở published / updated")
    void atom() {
        List<Entry> es = SourceCatalog.parseRss("""
                <feed xmlns="http://www.w3.org/2005/Atom">
                  <title>Beispiel</title>
                  <entry>
                    <title>Neue Studie zum Schlaf</title>
                    <link rel="alternate" href="https://example.org/news/schlaf#top"/>
                    <updated>2026-11-10T09:30:00Z</updated>
                  </entry>
                </feed>
                """);
        assertThat(es).containsExactly(new Entry("https://example.org/news/schlaf", "Neue Studie zum Schlaf",
                Instant.parse("2026-11-10T09:30:00Z")));
    }

    @Test
    @DisplayName("Trang mục lục: chỉ lấy đường dẫn khớp mẫu, bỏ mã phiên và tham số, theo thẻ base của trang")
    void indexPage() {
        String html = """
                <html><head><base href="https://www.dwd.de/"/></head><body>
                  <a href="DE/presse/pressemitteilungen/DE/2026/20261030_deutschlandwetter_oktober_news.html;jsessionid=0A1B.live31094?nn=495078"><img alt=""/></a>
                  <a href="DE/presse/pressemitteilungen/DE/2026/20261030_deutschlandwetter_oktober_news.html;jsessionid=0A1B.live31094?nn=495078">Deutschlandwetter im Oktober 2026</a>
                  <a href="DE/presse/pressemitteilungen/DE/2026/20261019_tornadobilanz_news.html?nn=495078">Vorläufige Tornadobilanz</a>
                  <a href="DE/presse/pressemitteilungen/pressemitteilungen_node.html">Alle Pressemitteilungen</a>
                  <a href="DE/service/impressum/impressum_node.html">Impressum</a>
                  <a href="mailto:presse@dwd.de">Kontakt</a>
                </body></html>
                """;
        List<Entry> es = SourceCatalog.parseIndex(html,
                "https://www.dwd.de/DE/presse/pressemitteilungen/pressemitteilungen_node.html",
                "/DE/presse/pressemitteilungen/DE/\\d{4}/[^/?#]+\\.html$");
        assertThat(es).containsExactly(
                new Entry("https://www.dwd.de/DE/presse/pressemitteilungen/DE/2026/20261030_deutschlandwetter_oktober_news.html",
                        "Deutschlandwetter im Oktober 2026", null),
                new Entry("https://www.dwd.de/DE/presse/pressemitteilungen/DE/2026/20261019_tornadobilanz_news.html",
                        "Vorläufige Tornadobilanz", null));
        assertThat(SourceCatalog.parseIndex(html, "https://www.dwd.de/", null)).isEmpty();
    }

    @Test
    @DisplayName("canonical: cùng một bài cho cùng một chuỗi và cùng mã băm; địa chỉ lạ ⇒ null")
    void canonical() {
        String a = SourceCatalog.canonical("HTTPS://WWW.Example.org/a/b/?utm_source=x&id=7&nn=1#frag");
        assertThat(a).isEqualTo("https://www.example.org/a/b?id=7");
        assertThat(SourceCatalog.canonical("https://www.example.org/a/b?id=7")).isEqualTo(a);
        assertThat(SourceCatalog.hash(a)).hasSize(64).isEqualTo(SourceCatalog.hash("https://www.example.org/a/b?id=7"));
        assertThat(SourceCatalog.canonical("https://example.org")).isEqualTo("https://example.org/");
        assertThat(SourceCatalog.canonical("mailto:a@b.de")).isNull();
        assertThat(SourceCatalog.canonical("javascript:void(0)")).isNull();
        assertThat(SourceCatalog.canonical("  ")).isNull();
        assertThat(SourceCatalog.canonical(null)).isNull();
    }

    @Test
    @DisplayName("score: đếm từ khoá trong tiêu đề; từ khoá dài khớp cả trong từ ghép, từ khoá ngắn phải đứng riêng")
    void score() {
        // Từ khoá là GỐC từ: "miet" khớp Miete, Mieten, Mietpreise; "miete" thì trượt "Mietpreise".
        List<String> wohnen = List.of("miet", "wohnung", "heizung", "bau");
        assertThat(SourceCatalog.score("Mietpreise steigen", List.of("miete"))).isZero();
        assertThat(SourceCatalog.score("Mietpreise und Wohnungsmarkt 2026", wohnen)).isEqualTo(2);
        assertThat(SourceCatalog.score("Neubau geht zurück", wohnen)).isZero();   // "bau" ngắn: không khớp trong từ ghép
        assertThat(SourceCatalog.score("Am Bau fehlen Fachkräfte", wohnen)).isEqualTo(1);
        assertThat(SourceCatalog.score(null, wohnen)).isZero();
        assertThat(SourceCatalog.score("Mieten steigen", List.of())).isZero();
    }

    @Test
    @DisplayName("Sitemap: chỉ lấy địa chỉ khớp mẫu, gộp trùng, tiêu đề tạm suy từ đường dẫn")
    void sitemap() {
        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                <url><loc>https://www.oesterreich.gv.at/de/themen/bauen_und_wohnen/wohnen/Seite.210100</loc></url>
                <url><loc> https://www.oesterreich.gv.at/de/themen/mobilitaet/Fussgaenger </loc></url>
                <url><loc>https://www.oesterreich.gv.at/de/themen/mobilitaet/Fussgaenger</loc></url>
                <url><loc>https://www.oesterreich.gv.at/de/themen/gesetze_und_recht/strafrecht/Seite.2460000</loc></url>
                <url><loc>https://www.oesterreich.gv.at/en/themen/mobilitaet/pedestrians</loc></url>
                <url><loc>https://www.oesterreich.gv.at/de/themen/mobilitaet</loc></url>
                </urlset>
                """;
        List<Entry> es = SourceCatalog.parseSitemap(xml, "/de/themen/(bauen_und_wohnen|mobilitaet)/[^?#]+$");
        assertThat(es).containsExactly(
                new Entry("https://www.oesterreich.gv.at/de/themen/bauen_und_wohnen/wohnen/Seite.210100",
                        "bauen und wohnen / wohnen", null),
                new Entry("https://www.oesterreich.gv.at/de/themen/mobilitaet/Fussgaenger", "mobilitaet / Fussgaenger", null));
        assertThat(SourceCatalog.parseSitemap(xml, null)).isEmpty();
        assertThat(SourceCatalog.parseSitemap(null, ".*")).isEmpty();
        assertThat(SourceCatalog.titleFromPath("https://x.example/de/themen/arbeit_beruf_und_pension/eltern-karenz/3/Seite.3590007"))
                .isEqualTo("arbeit beruf und pension / eltern karenz");
    }

    @Test
    @DisplayName("score: ä/ö/ü/ß khớp cách viết ae/oe/ue/ss trong đường dẫn, theo cả hai chiều")
    void scoreUmlauts() {
        assertThat(SourceCatalog.score("persoenliche dokumente / fuehrerschein", List.of("führerschein"))).isEqualTo(1);
        assertThat(SourceCatalog.score("Führerschein und Straßenverkehr", List.of("fuehrerschein", "strasse"))).isEqualTo(2);
        assertThat(SourceCatalog.score("mobilitaet / Fussgaenger", List.of("fußgänger", "mobilität"))).isEqualTo(2);
    }

    @Test
    @DisplayName("parseDate: RFC 1123, ISO có múi giờ, ISO UTC; dạng lạ ⇒ null")
    void dates() {
        assertThat(SourceCatalog.parseDate("Tue, 10 Nov 2026 12:00:00 GMT")).isEqualTo(Instant.parse("2026-11-10T12:00:00Z"));
        assertThat(SourceCatalog.parseDate("2026-11-10T13:00:00+01:00")).isEqualTo(Instant.parse("2026-11-10T12:00:00Z"));
        assertThat(SourceCatalog.parseDate("2026-11-10T12:00:00Z")).isEqualTo(Instant.parse("2026-11-10T12:00:00Z"));
        assertThat(SourceCatalog.parseDate("gestern")).isNull();
        assertThat(SourceCatalog.parseDate(null)).isNull();
    }
}
